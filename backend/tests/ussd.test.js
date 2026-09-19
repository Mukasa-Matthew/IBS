import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyUssdText } from '../src/modules/ussd/index.js';

describe('Africa\'s Talking USSD session routing', () => {
  it('treats whitespace-only text as the first menu request', () => {
    assert.deepEqual(classifyUssdText(''), { hop: 'menu', choice: null });
    assert.deepEqual(classifyUssdText('   '), { hop: 'menu', choice: null });
    assert.equal(classifyUssdText(' 1 ').hop, 'checkStatus');
  });

  it('treats 1 as check-status and 2 as report-problem', () => {
    assert.equal(classifyUssdText('1').hop, 'checkStatus');
    assert.equal(classifyUssdText('2').hop, 'reportProblem');
  });

  it('uses the last hop from Africa\'s Talking concatenated text', () => {
    assert.equal(classifyUssdText('1*1').hop, 'checkStatus');
    assert.equal(classifyUssdText('1*2').hop, 'reportProblem');
    assert.equal(classifyUssdText('1*9').hop, 'invalid');
    assert.equal(classifyUssdText('9').hop, 'invalid');
  });
});
