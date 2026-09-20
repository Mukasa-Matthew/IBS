import { query } from '../../db/pool.js';
import { config, africastalkingStatus } from '../../config/index.js';
import { localizeFailure } from '../localization/engine.js';
import { createThresholdTracker } from '../localization/threshold.js';
import { planIncidents } from '../localization/correlation.js';
import {
  applyScenario,
  observeArea,
  reportingPath,
  getSimulationState,
  syncAreaCodes,
} from '../simulation/index.js';
import {
  listServiceAreas,
  latestObservationsByArea,
  healthFromClassification,
  deriveTopology,
  overallNetworkStatus,
} from '../network/index.js';
import {
  ensureIncident,
  listIncidents,
  openIncidentsForArea,
  resolveIncident,
} from '../incidents/index.js';
import { logEvent, listEvents } from '../../services/events.js';
import { verifyAfricaTalking, listRecentSms } from '../../integrations/africastalking/sms.js';
import { listAreaAssignments } from '../technicians/index.js';

export const tracker = createThresholdTracker({
  failureThreshold: config.failureThreshold,
  recoveryThreshold: config.recoveryThreshold,
});

let tickLock = false;

function observationMessage(area, observation, result) {
  if (result.domain === 'HEALTHY') {
    return `${area.name} local access reachable`;
  }
  if (!observation.local_access_reachable) {
    return `${area.name} local access unreachable`;
  }
  if (!observation.core_reachable) {
    return `${area.name} core probe failed`;
  }
  if (!observation.internet_reachable) {
    return `${area.name} internet probe failed`;
  }
  return `${area.name} observation undetermined`;
}

export async function processTick() {
  if (tickLock) return;
  tickLock = true;
  try {
    const areas = await listServiceAreas();
    syncAreaCodes(areas.map((area) => area.code));
    const readyFailures = [];

    for (const area of areas) {
      const observation = observeArea(area.code);
      const localization = localizeFailure(observation);
      const threshold = tracker.record(area.id, localization.domain);
      const path = reportingPath(observation);
      const health = healthFromClassification(
        localization.domain === 'HEALTHY' ? 'HEALTHY' : localization.domain,
        localization.domain === 'HEALTHY' ? 0 : threshold.consecutiveFailures,
        config.failureThreshold,
      );

      await query(
        `INSERT INTO observations (
            service_area_id, local_access_reachable, core_reachable,
            internet_reachable, failure_domain
         ) VALUES ($1,$2,$3,$4,$5)`,
        [
          area.id,
          observation.local_access_reachable,
          observation.core_reachable,
          observation.internet_reachable,
          localization.domain,
        ],
      );

      await query(
        `UPDATE monitoring_agents
         SET primary_path_status = $2,
             oob_status = $3,
             last_seen_at = now()
         WHERE service_area_id = $1`,
        [area.id, path.primary_path_status, path.oob_status],
      );

      await query(`UPDATE service_areas SET health_state = $2 WHERE id = $1`, [
        area.id,
        health,
      ]);

      const notable =
        localization.domain !== 'HEALTHY' ||
        (threshold.consecutiveSuccesses > 0 &&
          threshold.consecutiveSuccesses <= config.recoveryThreshold);
      if (notable) {
        await logEvent({
          type: 'OBSERVATION',
          message: observationMessage(area, observation, localization),
          serviceAreaId: area.id,
        });
      }

      if (threshold.shouldOpen) {
        readyFailures.push({
          area: { ...area, health_state: health },
          domain: localization.domain,
          localization,
          consecutiveFailures: threshold.consecutiveFailures,
        });
      }

      if (threshold.shouldRecover) {
        const open = await openIncidentsForArea(area.id);
        for (const incident of open) {
          await resolveIncident(incident.id, tracker);
        }
      }
    }

    const plans = planIncidents(readyFailures);
    for (const plan of plans) {
      const sample = readyFailures.find((item) =>
        plan.areas.some((area) => area.id === item.area.id),
      );
      await ensureIncident({
        domain: plan.domain,
        areas: plan.areas,
        localization: sample.localization,
        consecutiveFailures: sample.consecutiveFailures,
      });
    }

    await query(
      `DELETE FROM observations
       WHERE id < (
         SELECT COALESCE(MAX(id), 0) - 800 FROM observations
       )`,
    );
  } finally {
    tickLock = false;
  }
}

export async function applyDemoScenario(scenarioKey) {
  const state = applyScenario(scenarioKey);
  tracker.reset();
  await logEvent({
    type: 'SIMULATION',
    message: `Demo scenario applied: ${state.label}`,
  });
  return state;
}

export async function getDashboard() {
  const areas = await listServiceAreas();
  const observations = await latestObservationsByArea();
  const incidents = await listIncidents({ includeResolved: true });
  const openIncidents = incidents.filter((incident) => incident.status !== 'RESOLVED');
  const events = await listEvents(50);
  const simulation = getSimulationState();
  const africastalking = await verifyAfricaTalking().catch(() => ({
    ...africastalkingStatus(),
    connected: false,
  }));
  const recentSms = await listRecentSms(10);

  const serviceAreas = [];
  for (const area of areas) {
    const obs = observations.get(area.id);
    const pathNote =
      area.oob_status === 'ACTIVE_SIMULATED_CELLULAR'
        ? 'Out-of-band reporting: ACTIVE / simulated cellular'
        : 'Out-of-band reporting: standby';
    const threshold = tracker.get(area.id);
    const assignments = await listAreaAssignments(area.id);
    serviceAreas.push({
      ...area,
      site_name: area.site_name || `${area.name} site rack`,
      access_device_name: area.access_device_name || `${area.name} OLT`,
      observation: obs || null,
      primary_path_label:
        area.primary_path_status === 'AVAILABLE' ? 'Available' : 'Unavailable',
      oob_label:
        area.oob_status === 'ACTIVE_SIMULATED_CELLULAR'
          ? 'Active / simulated cellular'
          : 'Standby',
      path_note: pathNote,
      technicians: assignments,
      threshold: {
        fail_domain: threshold.failDomain,
        consecutive_failures: threshold.failCount,
        consecutive_successes: threshold.healthyCount,
        failure_threshold: config.failureThreshold,
        recovery_threshold: config.recoveryThreshold,
      },
    });
  }

  const healthy = serviceAreas.filter((area) => area.health_state === 'HEALTHY').length;
  const degraded = serviceAreas.filter((area) => area.health_state === 'DEGRADED').length;
  const offline = serviceAreas.filter((area) =>
    ['FAILURE', 'UNKNOWN'].includes(area.health_state),
  ).length;
  const affectedCustomers = openIncidents.reduce(
    (sum, incident) => sum + (incident.potentially_affected_customer_count || 0),
    0,
  );

  return {
    generated_at: new Date().toISOString(),
    simulation_mode: true,
    network_status: overallNetworkStatus(serviceAreas, openIncidents),
    summary: {
      active_incidents: openIncidents.length,
      healthy_areas: healthy,
      degraded_areas: degraded,
      offline_areas: offline,
      potentially_affected_customers: affectedCustomers,
      failure_threshold: config.failureThreshold,
      recovery_threshold: config.recoveryThreshold,
      monitor_interval_ms: config.monitorIntervalMs,
    },
    africastalking: {
      configured: africastalking.configured,
      connected: Boolean(africastalking.connected),
      environment: africastalking.environment,
      mode: africastalking.mode,
      username: africastalking.username,
      alert_phone: africastalking.alert_phone,
      balance: africastalking.balance || null,
      detail: africastalking.detail || null,
    },
    topology: deriveTopology(serviceAreas, observations),
    service_areas: serviceAreas,
    incidents,
    active_incidents: openIncidents,
    events,
    recent_sms: recentSms,
    simulation,
  };
}
