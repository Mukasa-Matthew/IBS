import { DEMO_SITES } from '../../db/seed.js';

const HEALTHY = {
  local_access_reachable: true,
  core_reachable: true,
  internet_reachable: true,
};

const SITE_CODES = DEMO_SITES.map((site) => site.code);

function healthyAll(codes = SITE_CODES) {
  return Object.fromEntries(codes.map((code) => [code, { ...HEALTHY }]));
}

function failUplink(targetCode) {
  const areas = healthyAll();
  areas[targetCode] = {
    local_access_reachable: true,
    core_reachable: false,
    internet_reachable: false,
  };
  return areas;
}

function failLocal(targetCode) {
  const areas = healthyAll();
  areas[targetCode] = {
    local_access_reachable: false,
    core_reachable: true,
    internet_reachable: true,
  };
  return areas;
}

function failUpstream() {
  return Object.fromEntries(
    SITE_CODES.map((code) => [
      code,
      {
        local_access_reachable: true,
        core_reachable: true,
        internet_reachable: false,
      },
    ]),
  );
}

function ambiguous(targetCode) {
  const areas = healthyAll();
  areas[targetCode] = {
    local_access_reachable: true,
    core_reachable: false,
    internet_reachable: true,
  };
  return areas;
}

/** Built once from seeded site list so simulation stays in sync with topology. */
export const SCENARIOS = {
  NORMAL_NETWORK: {
    label: 'Normal network / restore all',
    areas: healthyAll(),
  },
  FAIL_UPSTREAM_INTERNET: {
    label: 'Fail ISP upstream internet',
    areas: failUpstream(),
  },
  ...Object.fromEntries(
    DEMO_SITES.map((site) => [
      `FAIL_${site.code}_UPLINK`,
      {
        label: `Fail ${site.name} core uplink`,
        areas: failUplink(site.code),
      },
    ]),
  ),
  ...Object.fromEntries(
    DEMO_SITES.slice(0, 2).map((site) => [
      `FAIL_${site.code}_LOCAL_ACCESS`,
      {
        label: `Fail ${site.name} local access`,
        areas: failLocal(site.code),
      },
    ]),
  ),
  AMBIGUOUS_FAILURE: {
    label: 'Ambiguous / contradictory (Seeta)',
    areas: ambiguous('SITE_SEETA'),
  },
  RESTORE_NETWORK: {
    label: 'Restore network',
    areas: healthyAll(),
  },
};

let currentScenario = 'NORMAL_NETWORK';
let areaState = healthyAll();

/** Ensure newly loaded DB codes exist in the live simulation map. */
export function syncAreaCodes(codes) {
  for (const code of codes) {
    if (!areaState[code]) {
      areaState[code] = { ...HEALTHY };
    }
  }
}

export function getSimulationState() {
  return {
    scenario: currentScenario,
    label: SCENARIOS[currentScenario]?.label || currentScenario,
    areas: structuredClone(areaState),
  };
}

export function applyScenario(scenarioKey) {
  const scenario = SCENARIOS[scenarioKey];
  if (!scenario) {
    throw new Error(`Unknown scenario: ${scenarioKey}`);
  }
  currentScenario = scenarioKey;
  areaState = structuredClone(scenario.areas);
  return getSimulationState();
}

export function observeArea(areaCode) {
  const observation = areaState[areaCode] || HEALTHY;
  return { ...observation, timestamp: new Date().toISOString() };
}

export function reportingPath(observation) {
  const primaryAvailable = observation.local_access_reachable && observation.core_reachable;
  if (primaryAvailable) {
    return {
      primary_path_status: 'AVAILABLE',
      oob_status: 'STANDBY',
      oob_label: 'Standby',
    };
  }
  return {
    primary_path_status: 'UNAVAILABLE',
    oob_status: 'ACTIVE_SIMULATED_CELLULAR',
    oob_label: 'Active / simulated cellular',
  };
}

export function listScenarios() {
  return Object.entries(SCENARIOS).map(([id, value]) => ({
    id,
    label: value.label,
  }));
}
