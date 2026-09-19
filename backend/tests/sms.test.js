import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatMsisdn,
  interpretSmsResponse,
  messagingUrl,
  SANDBOX_API_BASE,
  LIVE_API_BASE,
  buildMessagingParams,
} from '../src/integrations/africastalking/sms.js';

describe('Africa\'s Talking SMS client', () => {
  it('uses the sandbox host when the username is sandbox', () => {
    assert.equal(messagingUrl('sandbox'), `${SANDBOX_API_BASE}/version1/messaging`);
    assert.equal(messagingUrl('SANDBOX'), `${SANDBOX_API_BASE}/version1/messaging`);
  });

  it('uses the live host for production usernames', () => {
    assert.equal(messagingUrl('incidentbridge'), `${LIVE_API_BASE}/version1/messaging`);
  });

  it('formats technician numbers as international MSISDNs', () => {
    assert.equal(formatMsisdn('256700111001'), '+256700111001');
    assert.equal(formatMsisdn('+256700111001'), '+256700111001');
  });

  it('treats HTTP 201 with a successful recipient as sent', () => {
    const result = interpretSmsResponse(
      201,
      JSON.stringify({
        SMSMessageData: {
          Message: 'Sent to 1/1',
          Recipients: [{ statusCode: 101, status: 'Success', number: '+256700111001' }],
        },
      }),
    );
    assert.equal(result.ok, true);
  });

  it('does not treat a rejected recipient as sent', () => {
    const result = interpretSmsResponse(
      201,
      JSON.stringify({
        SMSMessageData: {
          Message: 'Sent to 0/1',
          Recipients: [{ statusCode: 403, status: 'Rejected', number: '+256700111001' }],
        },
      }),
    );
    assert.equal(result.ok, false);
  });

  it('fails closed on non-success HTTP statuses', () => {
    const result = interpretSmsResponse(401, '{"response":"InvalidKey"}');
    assert.equal(result.ok, false);
  });

  it('does not send a sender ID on the sandbox host', () => {
    const params = buildMessagingParams({
      username: 'sandbox',
      senderId: 'IncidentBridge',
      environment: 'sandbox',
      to: '256787106109',
      message: 'hello',
    });
    assert.equal(params.get('from'), null);
    assert.equal(params.get('to'), '+256787106109');
    assert.equal(params.get('enqueue'), '1');
  });

  it('sends a sender ID only in live', () => {
    const params = buildMessagingParams({
      username: 'incidentbridge',
      senderId: 'IncidentBridge',
      environment: 'live',
      to: '+256787106109',
      message: 'hello',
    });
    assert.equal(params.get('from'), 'IncidentBridge');
  });
});
