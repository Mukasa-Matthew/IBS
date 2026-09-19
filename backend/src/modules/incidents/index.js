import { query } from '../../db/pool.js';
import { config } from '../../config/index.js';
import {
  FailureDomain,
  displayNameForDomain,
  enrichFacts,
} from '../localization/engine.js';
import { potentiallyAffectedCount, impactStatement } from '../impact/index.js';
import { assignTechnician } from '../technicians/index.js';
import { notifyTechnician } from '../notifications/index.js';
import { logEvent } from '../../services/events.js';

function severityFor(domain, areas) {
  if (domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE) {
    return areas.length > 1 ? 'CRITICAL' : 'HIGH';
  }
  if (domain === FailureDomain.AREA_CORE_PATH_FAILURE) return 'HIGH';
  if (domain === FailureDomain.LOCAL_ACCESS_FAILURE) return 'HIGH';
  return 'MEDIUM';
}

function titleFor(domain, areas) {
  const names = areas.map((area) => area.name).join(' and ');
  switch (domain) {
    case FailureDomain.AREA_CORE_PATH_FAILURE:
      return `${areas[0].name} cannot reach the core network`;
    case FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE:
      return areas.length > 1
        ? 'Shared upstream internet connectivity failure'
        : `${names}: upstream internet connectivity failure`;
    case FailureDomain.LOCAL_ACCESS_FAILURE:
      return `${areas[0].name} local access failure`;
    default:
      return `${names}: undetermined failure domain`;
  }
}

function explanationFor(domain, localization, areas) {
  if (domain === FailureDomain.UNDETERMINED) {
    return 'Failure location could not be confidently determined. Engineer investigation required.';
  }
  if (domain === FailureDomain.AREA_CORE_PATH_FAILURE) {
    return `Connectivity appears unavailable between ${areas[0].name} and the core network.`;
  }
  if (domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE && areas.length > 1) {
    return 'Both service areas can reach the core, but internet connectivity is unavailable. This strongly indicates a shared upstream failure rather than independent area faults.';
  }
  return localization.inference;
}

async function nextReference(kind) {
  const result = await query(
    `UPDATE sequences SET value = value + 1 WHERE name = $1 RETURNING value`,
    [kind],
  );
  const value = result.rows[0].value;
  return kind === 'incident' ? `IB-${value}` : `CR-${String(value).padStart(4, '0')}`;
}

export async function listIncidents({ includeResolved = true } = {}) {
  const result = await query(
    `SELECT i.*, t.name AS technician_name, t.phone AS technician_phone,
            t.role AS technician_role, t.team AS technician_team
     FROM incidents i
     LEFT JOIN technicians t ON t.id = i.assigned_technician_id
     ${includeResolved ? '' : "WHERE i.status <> 'RESOLVED'"}
     ORDER BY i.detected_at DESC`,
  );

  const incidents = result.rows;
  if (incidents.length === 0) return [];

  const links = await query(
    `SELECT isa.incident_id, sa.id, sa.name, sa.code, sa.customer_count
     FROM incident_service_areas isa
     JOIN service_areas sa ON sa.id = isa.service_area_id
     WHERE isa.incident_id = ANY($1::uuid[])
     ORDER BY sa.name`,
    [incidents.map((incident) => incident.id)],
  );

  const byIncident = new Map();
  for (const row of links.rows) {
    if (!byIncident.has(row.incident_id)) byIncident.set(row.incident_id, []);
    byIncident.get(row.incident_id).push({
      id: row.id,
      name: row.name,
      code: row.code,
      customer_count: row.customer_count,
    });
  }

  return incidents.map((incident) => presentIncident(incident, byIncident.get(incident.id) || []));
}

function presentIncident(incident, areas) {
  const durationMs =
    incident.resolved_at && incident.detected_at
      ? new Date(incident.resolved_at).getTime() - new Date(incident.detected_at).getTime()
      : incident.detected_at
        ? Date.now() - new Date(incident.detected_at).getTime()
        : null;

  return {
    ...incident,
    areas,
    area_names: areas.map((area) => area.name),
    assigned_technician: incident.assigned_technician_id
      ? {
          id: incident.assigned_technician_id,
          name: incident.technician_name,
          phone: incident.technician_phone,
          role: incident.technician_role,
          team: incident.technician_team,
        }
      : null,
    duration_ms: durationMs,
    impact_statement: impactStatement(incident.potentially_affected_customer_count),
    failure_domain_label: displayNameForDomain(incident.failure_domain),
  };
}

export async function findOpenIncident(domain, areaIds) {
  if (domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE) {
    const result = await query(
      `SELECT i.*
       FROM incidents i
       WHERE i.failure_domain = $1 AND i.status <> 'RESOLVED'
       ORDER BY i.detected_at ASC
       LIMIT 1`,
      [domain],
    );
    return result.rows[0] || null;
  }

  const result = await query(
    `SELECT i.*
     FROM incidents i
     JOIN incident_service_areas isa ON isa.incident_id = i.id
     WHERE i.failure_domain = $1
       AND i.status <> 'RESOLVED'
       AND isa.service_area_id = ANY($2::uuid[])
     LIMIT 1`,
    [domain, areaIds],
  );
  return result.rows[0] || null;
}

export async function openIncidentsForArea(areaId) {
  const result = await query(
    `SELECT i.*
     FROM incidents i
     JOIN incident_service_areas isa ON isa.incident_id = i.id
     WHERE isa.service_area_id = $1 AND i.status <> 'RESOLVED'`,
    [areaId],
  );
  return result.rows;
}

async function incidentAreas(incidentId) {
  const result = await query(
    `SELECT sa.id, sa.name, sa.code, sa.customer_count, sa.technician_id,
            t.name AS technician_name, t.phone AS technician_phone,
            t.role AS technician_role, t.team AS technician_team
     FROM incident_service_areas isa
     JOIN service_areas sa ON sa.id = isa.service_area_id
     LEFT JOIN technicians t ON t.id = sa.technician_id
     WHERE isa.incident_id = $1
     ORDER BY sa.name`,
    [incidentId],
  );
  return result.rows;
}

async function attachAreas(incidentId, areas) {
  for (const area of areas) {
    await query(
      `INSERT INTO incident_service_areas (incident_id, service_area_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [incidentId, area.id],
    );
  }
}

export async function ensureIncident({ domain, areas, localization, consecutiveFailures }) {
  const areaIds = areas.map((area) => area.id);
  const existing = await findOpenIncident(domain, areaIds);
  const evidence = enrichFacts(localization, consecutiveFailures);

  if (existing) {
    const before = await incidentAreas(existing.id);
    await attachAreas(existing.id, areas);
    const allAreas = await incidentAreas(existing.id);
    const count = potentiallyAffectedCount(allAreas);
    const sharedUpstream =
      domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE && allAreas.length > 1;
    await query(
      `UPDATE incidents
       SET potentially_affected_customer_count = $2,
           evidence = $3,
           title = $4,
           severity = $5,
           explanation = $6
       WHERE id = $1`,
      [
        existing.id,
        count,
        evidence,
        titleFor(domain, allAreas),
        severityFor(domain, allAreas),
        explanationFor(domain, localization, allAreas),
      ],
    );
    if (allAreas.length > before.length) {
      await logEvent({
        type: 'CORRELATION',
        message: `${existing.reference} correlated across ${allAreas.map((area) => area.name).join(' and ')}${sharedUpstream ? ' as one shared upstream incident' : ''}`,
        incidentId: existing.id,
      });
    }
    return { created: false, incident: existing };
  }

  const technician = await assignTechnician(domain, areas);
  const count = potentiallyAffectedCount(areas);
  const reference = await nextReference('incident');
  const title = titleFor(domain, areas);
  const severity = severityFor(domain, areas);
  const explanation = explanationFor(domain, localization, areas);

  const inserted = await query(
    `INSERT INTO incidents (
        reference, title, failure_domain, severity, status,
        potentially_affected_customer_count, assigned_technician_id,
        evidence, explanation, notification_status
     ) VALUES ($1,$2,$3,$4,'ASSIGNED',$5,$6,$7,$8,'PENDING')
     RETURNING *`,
    [
      reference,
      title,
      domain,
      severity,
      count,
      technician?.id || null,
      evidence,
      explanation,
    ],
  );
  const incident = inserted.rows[0];
  await attachAreas(incident.id, areas);

  await logEvent({
    type: 'INCIDENT_DETECTED',
    message: `Incident ${reference} detected — ${title}`,
    incidentId: incident.id,
    serviceAreaId: areas[0]?.id,
  });
  await logEvent({
    type: 'IMPACT',
    message: `Impact analysis: ${impactStatement(count)}`,
    incidentId: incident.id,
  });
  if (technician) {
    await logEvent({
      type: 'ASSIGNMENT',
      message: `Assigned to ${technician.name}`,
      incidentId: incident.id,
    });
  }

  const notifyResult = await notifyTechnician({
    technician,
    incident: {
      ...incident,
      areas,
    },
  });

  const notificationStatus =
    notifyResult.status === 'SKIPPED' ? 'NOT_REQUIRED' : notifyResult.status;
  await query(
    `UPDATE incidents
     SET notification_status = $2, notification_detail = $3
     WHERE id = $1`,
    [incident.id, notificationStatus, notifyResult.detail || notifyResult.status],
  );

  if (notifyResult.status !== 'SKIPPED') {
    const verb =
      notifyResult.status === 'SENT'
        ? 'sent'
        : notifyResult.status === 'SIMULATED'
          ? 'simulated'
          : 'failed';
    await logEvent({
      type: 'NOTIFICATION',
      message: `SMS notification ${verb}${technician ? ` to ${technician.name}` : ''}`,
      incidentId: incident.id,
    });
  }

  return { created: true, incident: { ...incident, notification_status: notificationStatus } };
}

export async function resolveIncident(incidentId, tracker) {
  const areas = await incidentAreas(incidentId);
  const allRecovered = areas.every((area) => {
    const state = tracker.get(area.id);
    return state.healthyCount >= config.recoveryThreshold;
  });
  if (!allRecovered) return null;

  const updated = await query(
    `UPDATE incidents
     SET status = 'RESOLVED', resolved_at = COALESCE(resolved_at, now())
     WHERE id = $1 AND status <> 'RESOLVED'
     RETURNING *`,
    [incidentId],
  );
  const incident = updated.rows[0];
  if (!incident) return null;

  const durationMs =
    new Date(incident.resolved_at).getTime() - new Date(incident.detected_at).getTime();
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  await logEvent({
    type: 'RECOVERY',
    message: `Incident ${incident.reference} resolved after ${formatDuration(seconds)}`,
    incidentId: incident.id,
  });
  return incident;
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export async function markInvestigating(id) {
  const result = await query(
    `UPDATE incidents
     SET status = 'INVESTIGATING'
     WHERE id = $1 AND status <> 'RESOLVED'
     RETURNING *`,
    [id],
  );
  return result.rows[0] || null;
}

export async function activeIncidentForArea(areaId) {
  const result = await query(
    `SELECT i.*
     FROM incidents i
     JOIN incident_service_areas isa ON isa.incident_id = i.id
     WHERE isa.service_area_id = $1 AND i.status <> 'RESOLVED'
     ORDER BY i.detected_at DESC
     LIMIT 1`,
    [areaId],
  );
  return result.rows[0] || null;
}

export { nextReference };
