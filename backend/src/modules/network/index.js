import { query } from '../../db/pool.js';

export async function listServiceAreas() {
  const result = await query(
    `SELECT sa.id, sa.name, sa.code, sa.customer_count, sa.health_state,
            sa.technician_id,
            t.name AS technician_name, t.phone AS technician_phone, t.role AS technician_role,
            t.team AS technician_team,
            a.id AS agent_id, a.name AS agent_name,
            a.primary_path_status, a.oob_status, a.last_seen_at
     FROM service_areas sa
     LEFT JOIN technicians t ON t.id = sa.technician_id
     LEFT JOIN monitoring_agents a ON a.service_area_id = sa.id
     ORDER BY sa.name`,
  );
  return result.rows;
}

export async function getNocTechnician() {
  const result = await query(
    `SELECT id, name, role, phone, team
     FROM technicians
     WHERE role = 'NOC'
     ORDER BY name
     LIMIT 1`,
  );
  return result.rows[0] || null;
}

export async function latestObservationsByArea() {
  const result = await query(
    `SELECT DISTINCT ON (service_area_id)
            service_area_id, local_access_reachable, core_reachable,
            internet_reachable, failure_domain, observed_at
     FROM observations
     ORDER BY service_area_id, observed_at DESC`,
  );
  return new Map(result.rows.map((row) => [row.service_area_id, row]));
}

export function healthFromClassification(domain, consecutiveFailures, failureThreshold) {
  if (domain === 'HEALTHY' || domain === null) return 'HEALTHY';
  if (domain === 'UNDETERMINED' && consecutiveFailures >= failureThreshold) return 'UNKNOWN';
  if (consecutiveFailures >= failureThreshold) return 'FAILURE';
  if (consecutiveFailures > 0) return 'DEGRADED';
  return 'HEALTHY';
}

export function deriveTopology(areas, observations) {
  const byCode = Object.fromEntries(areas.map((area) => [area.code, { area, obs: observations.get(area.id) }]));
  const mukonoA = byCode.MUKONO_A;
  const mukonoB = byCode.MUKONO_B;

  function nodeState(health, fallbackObs) {
    if (health === 'FAILURE') return 'FAILURE';
    if (health === 'UNKNOWN') return 'UNKNOWN';
    if (health === 'DEGRADED') return 'DEGRADED';
    if (!fallbackObs) return 'UNKNOWN';
    return 'HEALTHY';
  }

  const internetWitnesses = [mukonoA, mukonoB].filter((item) => item?.obs?.core_reachable);
  const internetDownWitnesses = internetWitnesses.filter((item) => item.obs.internet_reachable === false);
  const coreDownA = mukonoA?.obs && mukonoA.obs.core_reachable === false;
  const coreDownB = mukonoB?.obs && mukonoB.obs.core_reachable === false;

  let internetState = 'HEALTHY';
  if (internetWitnesses.length === 0) internetState = 'UNKNOWN';
  else if (internetDownWitnesses.length === internetWitnesses.length) internetState = 'FAILURE';
  else if (internetDownWitnesses.length > 0) internetState = 'DEGRADED';

  let coreState = 'HEALTHY';
  if (coreDownA && coreDownB) coreState = 'FAILURE';
  else if (coreDownA || coreDownB) coreState = 'DEGRADED';

  return {
    nodes: [
      { id: 'INTERNET', label: 'Internet', state: internetState },
      { id: 'CORE', label: 'Core', state: coreState },
      {
        id: 'MUKONO_A',
        label: 'Mukono A',
        state: nodeState(mukonoA?.area.health_state, mukonoA?.obs),
      },
      {
        id: 'MUKONO_B',
        label: 'Mukono B',
        state: nodeState(mukonoB?.area.health_state, mukonoB?.obs),
      },
    ],
    links: [
      {
        id: 'CORE-INTERNET',
        from: 'CORE',
        to: 'INTERNET',
        state: internetState,
      },
      {
        id: 'CORE-MUKONO_A',
        from: 'CORE',
        to: 'MUKONO_A',
        state: coreDownA ? 'FAILURE' : mukonoA?.area.health_state === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY',
      },
      {
        id: 'CORE-MUKONO_B',
        from: 'CORE',
        to: 'MUKONO_B',
        state: coreDownB ? 'FAILURE' : mukonoB?.area.health_state === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY',
      },
    ],
  };
}

export function overallNetworkStatus(areas, openIncidents) {
  if (openIncidents.some((incident) => incident.severity === 'CRITICAL')) return 'CRITICAL';
  if (openIncidents.length > 0) return 'INCIDENT';
  if (areas.some((area) => area.health_state === 'UNKNOWN')) return 'UNKNOWN';
  if (areas.some((area) => area.health_state === 'DEGRADED' || area.health_state === 'FAILURE')) {
    return 'DEGRADED';
  }
  return 'HEALTHY';
}
