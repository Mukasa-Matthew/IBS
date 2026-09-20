import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUgPhone, normalizeUgPhone } from '../src/modules/technicians/phone.js';

describe('Ugandan phone normalization', () => {
  it('normalizes local 07 numbers to +256', () => {
    assert.equal(normalizeUgPhone('0755032436'), '+256755032436');
    assert.equal(normalizeUgPhone('+256755032436'), '+256755032436');
    assert.equal(normalizeUgPhone('256755032436'), '+256755032436');
  });

  it('rejects invalid numbers', () => {
    assert.equal(isValidUgPhone('0755032436'), true);
    assert.equal(isValidUgPhone('123'), false);
    assert.equal(isValidUgPhone('+254711000000'), false);
  });
});
