export const SCENARIOS = {
  NORMAL_NETWORK: {
    label: 'Normal network',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
    },
  },
  FAIL_MUKONO_A_UPLINK: {
    label: 'Fail Mukono A uplink',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: false, internet_reachable: false },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
    },
  },
  FAIL_MUKONO_B_UPLINK: {
    label: 'Fail Mukono B uplink',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
      MUKONO_B: { local_access_reachable: true, core_reachable: false, internet_reachable: false },
    },
  },
  FAIL_UPSTREAM_INTERNET: {
    label: 'Fail upstream internet',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: true, internet_reachable: false },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: false },
    },
  },
  FAIL_MUKONO_A_LOCAL_ACCESS: {
    label: 'Fail Mukono A local access',
    areas: {
      MUKONO_A: { local_access_reachable: false, core_reachable: true, internet_reachable: true },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
    },
  },
  FAIL_MUKONO_B_LOCAL_ACCESS: {
    label: 'Fail Mukono B local access',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
      MUKONO_B: { local_access_reachable: false, core_reachable: true, internet_reachable: true },
    },
  },
  AMBIGUOUS_FAILURE: {
    label: 'Ambiguous failure',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: false, internet_reachable: true },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
    },
  },
  RESTORE_NETWORK: {
    label: 'Restore network',
    areas: {
      MUKONO_A: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
      MUKONO_B: { local_access_reachable: true, core_reachable: true, internet_reachable: true },
    },
  },
};

function cloneHealthy() {
  return structuredClone(SCENARIOS.NORMAL_NETWORK.areas);
}

let currentScenario = 'NORMAL_NETWORK';
let areaState = cloneHealthy();

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
  const observation = areaState[areaCode];
  if (!observation) {
    throw new Error(`Unknown service area: ${areaCode}`);
  }
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
