import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createThresholdTracker } from '../src/modules/localization/threshold.js';
import { FailureDomain } from '../src/modules/localization/engine.js';

describe('consecutive failure and recovery thresholds', () => {
  it('does not open an incident after a single failed probe', () => {
    const tracker = createThresholdTracker({ failureThreshold: 3, recoveryThreshold: 3 });
    const first = tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    const second = tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    assert.equal(first.shouldOpen, false);
    assert.equal(second.shouldOpen, false);
    assert.equal(second.consecutiveFailures, 2);
  });

  it('opens after the configured consecutive failure threshold', () => {
    const tracker = createThresholdTracker({ failureThreshold: 3, recoveryThreshold: 3 });
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    const third = tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    assert.equal(third.shouldOpen, true);
    assert.equal(third.consecutiveFailures, 3);
  });

  it('resets the failure counter when the domain changes', () => {
    const tracker = createThresholdTracker({ failureThreshold: 3, recoveryThreshold: 3 });
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    const changed = tracker.record('A', FailureDomain.LOCAL_ACCESS_FAILURE);
    assert.equal(changed.shouldOpen, false);
    assert.equal(changed.consecutiveFailures, 1);
    assert.equal(changed.domain, FailureDomain.LOCAL_ACCESS_FAILURE);
  });

  it('does not recover after a single successful probe', () => {
    const tracker = createThresholdTracker({ failureThreshold: 3, recoveryThreshold: 3 });
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    const oneSuccess = tracker.record('A', FailureDomain.HEALTHY);
    assert.equal(oneSuccess.shouldRecover, false);
    assert.equal(oneSuccess.consecutiveSuccesses, 1);
  });

  it('recovers after the configured consecutive success threshold', () => {
    const tracker = createThresholdTracker({ failureThreshold: 3, recoveryThreshold: 3 });
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.AREA_CORE_PATH_FAILURE);
    tracker.record('A', FailureDomain.HEALTHY);
    tracker.record('A', FailureDomain.HEALTHY);
    const recovered = tracker.record('A', FailureDomain.HEALTHY);
    assert.equal(recovered.shouldRecover, true);
    assert.equal(recovered.consecutiveSuccesses, 3);
  });
});
