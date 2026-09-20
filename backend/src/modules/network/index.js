import { query } from '../../db/pool.js';

export async function listServiceAreas() {
  const result = await query(
    `SELECT sa.id, sa.name, sa.code, sa.customer_count, sa.health_state,
            sa.technician_id, sa.site_name, sa.access_device_name,
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
    `SELECT id, name, role, phone, team, active
     FROM technicians
     WHERE role = 'NOC' AND COALESCE(active, true) = true
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

function nodeState(health, fallbackObs) {
  if (health === 'FAILURE') return 'FAILURE';
  if (health === 'UNKNOWN') return 'UNKNOWN';
  if (health === 'DEGRADED') return 'DEGRADED';
  if (!fallbackObs) return 'UNKNOWN';
  return 'HEALTHY';
}

/** Worst of two topology states — used to cascade failures down a path. */
function worseState(a, b) {
  const rank = { HEALTHY: 0, DEGRADED: 1, UNKNOWN: 2, FAILURE: 3 };
  const left = a || 'HEALTHY';
  const right = b || 'HEALTHY';
  return (rank[left] ?? 0) >= (rank[right] ?? 0) ? left : right;
}

/**
 * Dynamic topology: Internet → upstream → core → each site rack → OLT → customers.
 * Layout positions are computed on the frontend from node ids; backend only emits graph data.
 *
 * Path cascade: if a hop is down (uplink, site, or backbone), everything downstream on that
 * branch shows the same impact — OLT/customers must not stay green when the route is broken.
 */
export function deriveTopology(areas, observations) {
  const nodes = [
    { id: 'INTERNET', label: 'Internet', type: 'cloud', state: 'HEALTHY' },
    { id: 'UPSTREAM', label: 'ISP upstream', type: 'provider', state: 'HEALTHY' },
    { id: 'CORE', label: 'ISP core', type: 'core', state: 'HEALTHY' },
  ];
  const links = [
    { id: 'INTERNET-UPSTREAM', from: 'INTERNET', to: 'UPSTREAM', label: 'Internet transit', state: 'HEALTHY' },
    { id: 'UPSTREAM-CORE', from: 'UPSTREAM', to: 'CORE', label: 'ISP upstream', state: 'HEALTHY' },
  ];

  const siteEntries = areas.map((area) => ({
    area,
    obs: observations.get(area.id),
  }));

  const internetWitnesses = siteEntries.filter((item) => item.obs?.core_reachable);
  const internetDownWitnesses = internetWitnesses.filter((item) => item.obs.internet_reachable === false);

  let internetState = 'HEALTHY';
  if (internetWitnesses.length === 0) internetState = 'UNKNOWN';
  else if (internetDownWitnesses.length === internetWitnesses.length && internetWitnesses.length > 0) {
    internetState = 'FAILURE';
  } else if (internetDownWitnesses.length > 0) internetState = 'DEGRADED';

  const coreDownCount = siteEntries.filter((item) => item.obs && item.obs.core_reachable === false).length;
  let coreState = 'HEALTHY';
  if (coreDownCount === siteEntries.length && siteEntries.length > 0) coreState = 'FAILURE';
  else if (coreDownCount > 0) coreState = 'DEGRADED';

  // Backbone: upstream failure paints internet + upstream; total core loss paints core red.
  nodes[0].state = internetState;
  nodes[1].state = worseState(internetState, coreState === 'FAILURE' ? 'FAILURE' : 'HEALTHY');
  nodes[2].state = worseState(coreState, internetState === 'FAILURE' ? 'DEGRADED' : 'HEALTHY');
  links[0].state = internetState;
  links[1].state = worseState(internetState, coreState === 'FAILURE' ? 'FAILURE' : 'HEALTHY');

  for (const { area, obs } of siteEntries) {
    const code = area.code;
    const areaState = nodeState(area.health_state, obs);
    const localDown = obs && obs.local_access_reachable === false;
    const coreDown = obs && obs.core_reachable === false;
    const inetDown = obs && obs.internet_reachable === false;

    // Uplink hop (core → site rack)
    let uplinkState = 'HEALTHY';
    if (coreDown) uplinkState = 'FAILURE';
    else if (coreState === 'FAILURE') uplinkState = 'FAILURE';
    else if (area.health_state === 'DEGRADED') uplinkState = 'DEGRADED';

    // Site rack: own health + anything blocking the path above it
    let siteState = areaState;
    if (coreDown || coreState === 'FAILURE') siteState = worseState(siteState, 'FAILURE');
    if (internetState === 'FAILURE') siteState = worseState(siteState, 'FAILURE');
    else if (inetDown) siteState = worseState(siteState, 'DEGRADED');

    // Everything below the rack (OLT → customers) inherits the broken route.
    // Local access failure also marks the access segment; uplink/site failure paints the whole branch.
    let branchState = siteState;
    if (localDown) branchState = worseState(branchState, 'FAILURE');
    if (uplinkState === 'FAILURE' || siteState === 'FAILURE') {
      branchState = worseState(branchState, 'FAILURE');
    } else if (uplinkState === 'DEGRADED' || siteState === 'DEGRADED') {
      branchState = worseState(branchState, 'DEGRADED');
    }

    const siteToOltState = localDown ? 'FAILURE' : branchState;
    const oltToCustState = branchState;

    nodes.push(
      {
        id: code,
        label: area.site_name || `${area.name} rack`,
        type: 'site',
        service_area: area.name,
        state: siteState,
        customer_count: area.customer_count,
        technician: area.technician_name,
      },
      {
        id: `OLT_${code}`,
        label: area.access_device_name || `${area.name} OLT`,
        type: 'access',
        service_area: area.name,
        state: branchState,
      },
      {
        id: `CUST_${code}`,
        label: `${area.name} customers (${area.customer_count})`,
        type: 'customers',
        service_area: area.name,
        state: branchState,
        customer_count: area.customer_count,
      },
    );

    links.push(
      {
        id: `CORE-${code}`,
        from: 'CORE',
        to: code,
        label: `${area.name} fibre uplink`,
        state: uplinkState,
      },
      {
        id: `${code}-OLT`,
        from: code,
        to: `OLT_${code}`,
        label: 'Site access',
        state: siteToOltState,
      },
      {
        id: `OLT-${code}-CUST`,
        from: `OLT_${code}`,
        to: `CUST_${code}`,
        label: 'Local access network',
        state: oltToCustState,
      },
    );
  }

  return { nodes, links };
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
