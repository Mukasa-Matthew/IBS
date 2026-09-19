export function createThresholdTracker({
  failureThreshold = 3,
  recoveryThreshold = 3,
} = {}) {
  const areas = new Map();

  function stateFor(areaId) {
    if (!areas.has(areaId)) {
      areas.set(areaId, {
        failDomain: null,
        failCount: 0,
        healthyCount: 0,
      });
    }
    return areas.get(areaId);
  }

  function record(areaId, domain) {
    const state = stateFor(areaId);

    if (domain === 'HEALTHY') {
      state.failDomain = null;
      state.failCount = 0;
      state.healthyCount += 1;
      return snapshot(state, false, state.healthyCount >= recoveryThreshold);
    }

    if (state.failDomain === domain) {
      state.failCount += 1;
    } else {
      state.failDomain = domain;
      state.failCount = 1;
    }
    state.healthyCount = 0;

    return snapshot(state, state.failCount >= failureThreshold, false);
  }

  function snapshot(state, shouldOpen, shouldRecover) {
    return {
      domain: state.failDomain,
      consecutiveFailures: state.failCount,
      consecutiveSuccesses: state.healthyCount,
      shouldOpen,
      shouldRecover,
    };
  }

  function get(areaId) {
    return { ...stateFor(areaId) };
  }

  function reset(areaId) {
    if (areaId) {
      areas.set(areaId, { failDomain: null, failCount: 0, healthyCount: 0 });
      return;
    }
    areas.clear();
  }

  return { record, get, reset };
}
