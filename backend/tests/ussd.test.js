import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyUssdText,
  normalizeIncidentReference,
  parseUssdParts,
} from '../src/modules/ussd/index.js';

describe("Africa's Talking USSD session routing", () => {
  it('treats whitespace-only text as the first menu request', () => {
    assert.deepEqual(classifyUssdText(''), { hop: 'menu', choice: null });
    assert.deepEqual(classifyUssdText('   '), { hop: 'menu', choice: null });
    assert.equal(classifyUssdText(' 1 ').hop, 'checkStatus');
  });

  it('treats 1 as check-status and 2 as report-problem (customer hops)', () => {
    assert.equal(classifyUssdText('1').hop, 'checkStatus');
    assert.equal(classifyUssdText('2').hop, 'reportProblem');
  });

  it("uses the last hop from Africa's Talking concatenated text", () => {
    assert.equal(classifyUssdText('1*1').hop, 'checkStatus');
    assert.equal(classifyUssdText('1*2').hop, 'reportProblem');
    assert.equal(classifyUssdText('1*9').hop, 'invalid');
    assert.equal(classifyUssdText('9').hop, 'invalid');
  });

  it('parses multi-hop technician reference entry', () => {
    assert.deepEqual(parseUssdParts('1*IB-1056'), ['1', 'IB-1056']);
    assert.deepEqual(parseUssdParts('1*1056'), ['1', '1056']);
  });

  it('normalizes incident references for USSD entry', () => {
    assert.equal(normalizeIncidentReference('ib-1056'), 'IB-1056');
    assert.equal(normalizeIncidentReference('1056'), 'IB-1056');
    assert.equal(normalizeIncidentReference(' IB 1056 '), 'IB-1056');
    assert.equal(normalizeIncidentReference('IB1056'), 'IB-1056');
  });
});
