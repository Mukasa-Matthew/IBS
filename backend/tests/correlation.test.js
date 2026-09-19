import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planIncidents } from '../src/modules/localization/correlation.js';
import { FailureDomain } from '../src/modules/localization/engine.js';

const mukonoA = { id: 'a', name: 'Mukono A', code: 'MUKONO_A' };
const mukonoB = { id: 'b', name: 'Mukono B', code: 'MUKONO_B' };

describe('central correlation', () => {
  it('creates one shared upstream incident when both areas lose internet', () => {
    const plans = planIncidents([
      { area: mukonoA, domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE },
      { area: mukonoB, domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE },
    ]);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].shared, true);
    assert.equal(plans[0].domain, FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE);
    assert.deepEqual(
      plans[0].areas.map((area) => area.code),
      ['MUKONO_A', 'MUKONO_B'],
    );
  });

  it('keeps an area-to-core failure associated with that area only', () => {
    const plans = planIncidents([
      { area: mukonoA, domain: FailureDomain.AREA_CORE_PATH_FAILURE },
    ]);
    assert.equal(plans.length, 1);
    assert.equal(plans[0].shared, false);
    assert.equal(plans[0].areas.length, 1);
    assert.equal(plans[0].areas[0].code, 'MUKONO_A');
  });

  it('does not merge unrelated local and upstream failures', () => {
    const plans = planIncidents([
      { area: mukonoA, domain: FailureDomain.LOCAL_ACCESS_FAILURE },
      { area: mukonoB, domain: FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE },
    ]);
    assert.equal(plans.length, 2);
    assert.equal(
      plans.some((plan) => plan.domain === FailureDomain.LOCAL_ACCESS_FAILURE && plan.areas[0].code === 'MUKONO_A'),
      true,
    );
  });
});
