import { africastalkingConfigured, africastalkingStatus, config } from '../../config/index.js';
import { query } from '../../db/pool.js';

export const LIVE_API_BASE = 'https://api.africastalking.com';
export const SANDBOX_API_BASE = 'https://api.sandbox.africastalking.com';

const SUCCESS_STATUS_CODES = new Set([100, 101, 102]);

let lastSms = null;

export function getLastSms() {
  return lastSms;
}

export function apiBase(username = config.africastalking.username) {
  return String(username || '').toLowerCase() === 'sandbox' ? SANDBOX_API_BASE : LIVE_API_BASE;
}

export function messagingUrl(username = config.africastalking.username) {
  return `${apiBase(username)}/version1/messaging`;
}

export function formatMsisdn(phone) {
  const digits = String(phone || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  return `+${digits}`;
}

export function buildMessagingParams({ username, senderId, environment, to, message }) {
  const params = new URLSearchParams({
    username,
    to: formatMsisdn(to),
    message,
    enqueue: '1',
  });
  if (senderId && environment === 'live') {
    params.set('from', senderId);
  }
  return params;
}

export function interpretSmsResponse(httpStatus, bodyText) {
  if (httpStatus !== 200 && httpStatus !== 201) {
    return {
      ok: false,
      detail: `Africa's Talking HTTP ${httpStatus}: ${summarizeBody(bodyText)}`,
    };
  }

  const parsed = parseJson(bodyText);
  const recipients = parsed?.SMSMessageData?.Recipients;
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return {
      ok: false,
      detail: parsed?.SMSMessageData?.Message || summarizeBody(bodyText) || 'No recipients in Africa\'s Talking response',
    };
  }

  const accepted = recipients.filter((recipient) => {
    const code = Number(recipient.statusCode);
    const status = String(recipient.status || '').toLowerCase();
    return SUCCESS_STATUS_CODES.has(code) || status === 'success' || status.includes('sent');
  });
  const first = recipients[0] || {};

  if (accepted.length === 0) {
    return {
      ok: false,
      detail: first?.status || parsed?.SMSMessageData?.Message || 'Africa\'s Talking rejected the recipient',
      provider_message_id: first.messageId || null,
      provider_status: first.status || null,
      provider_status_code: first.statusCode != null ? String(first.statusCode) : null,
      cost: first.cost || null,
    };
  }

  return {
    ok: true,
    detail: parsed?.SMSMessageData?.Message || 'Accepted by Africa\'s Talking',
    provider_message_id: first.messageId || null,
    provider_status: first.status || null,
    provider_status_code: first.statusCode != null ? String(first.statusCode) : null,
    cost: first.cost || null,
  };
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText);
  } catch {
    return null;
  }
}

function summarizeBody(bodyText) {
  return String(bodyText || '').replace(/\s+/g, ' ').slice(0, 300);
}

function rememberSms(record) {
  lastSms = { ...record, at: new Date().toISOString() };
}

async function persistOutbound(record) {
  rememberSms(record);
  try {
    await query(
      `INSERT INTO sms_messages (
          purpose, to_msisdn, message, status, provider, environment, detail,
          provider_message_id, provider_status, provider_status_code, cost, incident_id
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        record.purpose || null,
        record.to,
        record.message,
        record.status,
        record.provider,
        record.environment || null,
        record.detail || null,
        record.provider_message_id || null,
        record.provider_status || null,
        record.provider_status_code || null,
        record.cost || null,
        record.incidentId || null,
      ],
    );
  } catch (error) {
    console.error('[sms:persist]', error.message);
  }
}

export async function listRecentSms(limit = 20) {
  const result = await query(
    `SELECT id, created_at, purpose, to_msisdn, message, status, provider,
            environment, detail, provider_message_id, provider_status,
            provider_status_code, cost, incident_id
     FROM sms_messages
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function sendSms({ to, message, purpose = 'manual', incidentId = null }) {
  const destination = formatMsisdn(to);
  if (!destination || !message) {
    const result = {
      status: 'FAILED',
      provider: 'none',
      detail: 'Missing recipient or message',
      to: destination || null,
      purpose,
      message: message || '',
      incidentId,
    };
    await persistOutbound(result);
    return result;
  }

  if (!africastalkingConfigured()) {
    console.log(`[sms:simulated] to=${destination} ${message.replaceAll('\n', ' | ')}`);
    const result = {
      status: 'SIMULATED',
      provider: 'mock',
      detail: 'Africa\'s Talking credentials are not configured. Message was not sent.',
      to: destination,
      purpose,
      message,
      incidentId,
    };
    await persistOutbound(result);
    return result;
  }

  const { username, apiKey, senderId, environment } = config.africastalking;
  const url = messagingUrl(username);
  const body = buildMessagingParams({
    username,
    senderId,
    environment,
    to: destination,
    message,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        apiKey,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const payload = await response.text();
    const interpretation = interpretSmsResponse(response.status, payload);

    if (!interpretation.ok) {
      console.error(`[sms:failed] env=${environment} to=${destination} ${interpretation.detail}`);
      const result = {
        status: 'FAILED',
        provider: 'africastalking',
        environment,
        detail: interpretation.detail,
        to: destination,
        purpose,
        message,
        incidentId,
        provider_message_id: interpretation.provider_message_id || null,
        provider_status: interpretation.provider_status || null,
        provider_status_code: interpretation.provider_status_code || null,
        cost: interpretation.cost || null,
      };
      await persistOutbound(result);
      return result;
    }

    console.log(`[sms:sent] env=${environment} to=${destination} id=${interpretation.provider_message_id || '-'}`);
    const result = {
      status: 'SENT',
      provider: 'africastalking',
      environment,
      detail: interpretation.detail,
      to: destination,
      purpose,
      message,
      incidentId,
      provider_message_id: interpretation.provider_message_id || null,
      provider_status: interpretation.provider_status || null,
      provider_status_code: interpretation.provider_status_code || null,
      cost: interpretation.cost || null,
    };
    await persistOutbound(result);
    return result;
  } catch (error) {
    console.error('[sms:failed]', error.message);
    const result = {
      status: 'FAILED',
      provider: 'africastalking',
      environment,
      detail: error.message,
      to: destination,
      purpose,
      message,
      incidentId,
    };
    await persistOutbound(result);
    return result;
  }
}

export async function recordDeliveryReport(payload) {
  const identifier = payload.id || payload.identifier || null;
  const phoneNumber = payload.phoneNumber || payload.phone_number || null;
  const status = payload.status || null;
  const retryCount = payload.retryCount || payload.retry_count || null;
  const networkCode = payload.networkCode || payload.network_code || null;
  const failureReason = payload.failureReason || payload.failure_reason || null;

  await query(
    `INSERT INTO sms_delivery_reports (
        identifier, phone_number, retry_count, network_code, status, failure_reason
     ) VALUES ($1,$2,$3,$4,$5,$6)`,
    [identifier, phoneNumber, retryCount, networkCode, status, failureReason],
  );

  if (identifier) {
    await query(
      `UPDATE sms_messages
       SET provider_status = COALESCE($2, provider_status),
           detail = COALESCE($3, detail)
       WHERE provider_message_id = $1`,
      [identifier, status, failureReason || status],
    );
  }

  console.log(
    `[sms:delivery] id=${identifier || '-'} phone=${phoneNumber || '-'} status=${status || '-'}`,
  );
  return { ok: true };
}

export async function verifyAfricaTalking() {
  const status = africastalkingStatus();
  if (!status.configured) {
    return {
      ok: false,
      connected: false,
      ...status,
      detail: 'AT_USERNAME and AT_API_KEY are not both set.',
    };
  }

  const { username, apiKey, environment } = config.africastalking;
  const url = `${apiBase(username)}/version1/user?username=${encodeURIComponent(username)}`;

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        apiKey,
        Accept: 'application/json',
      },
    });
    const payload = await response.text();
    const parsed = parseJson(payload);
    const balance = parsed?.UserData?.balance;

    if (!response.ok || !parsed?.UserData) {
      return {
        ok: false,
        connected: false,
        ...status,
        http_status: response.status,
        detail: summarizeBody(payload) || `Africa's Talking HTTP ${response.status}`,
      };
    }

    return {
      ok: true,
      connected: true,
      ...status,
      http_status: response.status,
      balance: balance || null,
      detail: `Authenticated to Africa's Talking ${environment}.`,
    };
  } catch (error) {
    return {
      ok: false,
      connected: false,
      ...status,
      detail: error.message,
    };
  }
}

export function logSmsProvider() {
  const status = africastalkingStatus();
  if (!status.configured) {
    console.log('[sms] Africa\'s Talking not configured — HIGH/CRITICAL alerts will be SIMULATED');
    return;
  }
  console.log(
    `[sms] Africa's Talking ${status.environment} ready (username=${status.username}, url=${messagingUrl(status.username)}, alert=${status.alert_phone || 'none'})`,
  );
}
