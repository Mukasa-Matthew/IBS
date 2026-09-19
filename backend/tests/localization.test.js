import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { localizeFailure, FailureDomain } from '../src/modules/localization/engine.js';

describe('failure localization engine', () => {
  it('classifies a healthy path', () => {
    const result = localizeFailure({
      local_access_reachable: true,
      core_reachable: true,
      internet_reachable: true,
    });
    assert.equal(result.domain, FailureDomain.HEALTHY);
    assert.equal(result.facts.every((fact) => fact.ok), true);
  });

  it('localizes area-to-core path failure without claiming a fibre cut', () => {
    const result = localizeFailure({
      local_access_reachable: true,
      core_reachable: false,
      internet_reachable: false,
    });
    assert.equal(result.domain, FailureDomain.AREA_CORE_PATH_FAILURE);
    assert.match(result.inference, /core/i);
    assert.doesNotMatch(result.explanation, /fibre cable has been cut/i);
    assert.match(result.explanation, /not proven/i);
  });

  it('localizes upstream internet failure', () => {
    const result = localizeFailure({
      local_access_reachable: true,
      core_reachable: true,
      internet_reachable: false,
    });
    assert.equal(result.domain, FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE);
  });

  it('localizes local access failure', () => {
    const result = localizeFailure({
      local_access_reachable: false,
      core_reachable: true,
      internet_reachable: true,
    });
    assert.equal(result.domain, FailureDomain.LOCAL_ACCESS_FAILURE);
  });

  it('returns undetermined for contradictory observations', () => {
    const result = localizeFailure({
      local_access_reachable: true,
      core_reachable: false,
      internet_reachable: true,
    });
    assert.equal(result.domain, FailureDomain.UNDETERMINED);
    assert.match(result.inference, /could not be confidently determined/i);
  });

  it('returns undetermined when all probes fail', () => {
    const result = localizeFailure({
      local_access_reachable: false,
      core_reachable: false,
      internet_reachable: false,
    });
    assert.equal(result.domain, FailureDomain.UNDETERMINED);
  });
});
