import { query } from '../../db/pool.js';
import { activeIncidentForArea } from '../incidents/index.js';
import { nextReference } from '../incidents/index.js';
import { logEvent } from '../../services/events.js';
import { sendSms } from '../../integrations/africastalking/sms.js';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '').replace(/^0/, '256');
}

export function classifyUssdText(text) {
  const input = String(text ?? '').trim();
  if (input === '') return { hop: 'menu', choice: null };
  const parts = input
    .split('*')
    .map((part) => part.trim())
    .filter((part) => part !== '');
  const last = parts[parts.length - 1] || '';
  if (last === '1') return { hop: 'checkStatus', choice: '1' };
  if (last === '2') return { hop: 'reportProblem', choice: '2' };
  return { hop: 'invalid', choice: last || null };
}

let lastCallback = null;

export function getLastUssdCallback() {
  return lastCallback;
}

export async function resolveSubscriber(phone) {
  const existing = await findCustomerByPhone(phone);
  if (existing) return existing;

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const area = await query(
    `SELECT id, name, code FROM service_areas WHERE code = 'MUKONO_A' LIMIT 1`,
  );
  if (!area.rows[0]) return null;

  const reference = `CUST-SIM-${normalized.slice(-6)}`;
  const inserted = await query(
    `INSERT INTO customers (reference, service_area_id, phone, service_status)
     VALUES ($1, $2, $3, 'ACTIVE')
     ON CONFLICT (reference) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id, reference, phone, service_area_id`,
    [reference, area.rows[0].id, normalized],
  );

  return {
    ...inserted.rows[0],
    service_area_name: area.rows[0].name,
    service_area_code: area.rows[0].code,
  };
}

export async function findCustomerByPhone(phone) {
  const normalized = normalizePhone(phone);
  const result = await query(
    `SELECT c.id, c.reference, c.phone, c.service_area_id,
            sa.name AS service_area_name, sa.code AS service_area_code
     FROM customers c
     JOIN service_areas sa ON sa.id = c.service_area_id
     WHERE regexp_replace(c.phone, '[^0-9]', '', 'g') = $1
     ORDER BY CASE WHEN c.reference LIKE 'CUST-SIM-%' THEN 1 ELSE 0 END, c.reference
     LIMIT 1`,
    [normalized],
  );
  return result.rows[0] || null;
}

async function statusMessage(customer) {
  if (!customer) {
    return 'This phone number is not registered. Dial again after launching the sandbox simulator.';
  }
  const incident = await activeIncidentForArea(customer.service_area_id);
  if (incident) {
    return `A known network incident is currently affecting your service area. Our technical team has been notified and is investigating. Ref: ${incident.reference}.`;
  }
  return 'No known network incident is currently affecting your service area.';
}

async function reportProblem(customer, phone) {
  if (!customer) {
    return 'This phone number is not registered in the IncidentBridge demo subscriber map.';
  }
  const incident = await activeIncidentForArea(customer.service_area_id);
  if (incident) {
    return `Your service is already associated with an active network incident. Our technical team has been notified. Ref: ${incident.reference}.`;
  }

  const reference = await nextReference('report');
  await query(
    `INSERT INTO customer_reports (reference, customer_id, phone, service_area_id, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      reference,
      customer.id,
      phone,
      customer.service_area_id,
      'Customer reported a problem via USSD',
    ],
  );
  await logEvent({
    type: 'USSD',
    message: `Customer report ${reference} received from ${customer.service_area_name}`,
    serviceAreaId: customer.service_area_id,
  });

  const confirmation = await sendSms({
    to: phone,
    message: `IncidentBridge: report ${reference} received. Our technical team has been notified.`,
    purpose: 'ussd_report_confirmation',
  });
  await logEvent({
    type: 'NOTIFICATION',
    message: `USSD confirmation SMS ${confirmation.status} to ${phone}`,
    serviceAreaId: customer.service_area_id,
  });

  return `Your report has been received. Ref: ${reference}.`;
}

export async function handleUssd({ sessionId, serviceCode, phoneNumber, text }) {
  const { hop, choice } = classifyUssdText(text);
  let response;

  if (hop === 'menu') {
    response = 'CON IncidentBridge\n1. Check my service status\n2. Report a problem';
  } else {
    const customer = await resolveSubscriber(phoneNumber);
    if (choice === '1') {
      response = `END ${await statusMessage(customer)}`;
    } else if (choice === '2') {
      response = `END ${await reportProblem(customer, phoneNumber)}`;
    } else {
      response = 'END Invalid selection. Dial again and choose 1 or 2.';
    }
  }

  lastCallback = {
    at: new Date().toISOString(),
    sessionId: sessionId || null,
    serviceCode: serviceCode || null,
    phoneNumber: phoneNumber || null,
    text: text ?? '',
    hop,
    response,
  };

  console.log(
    `[ussd] session=${sessionId || '-'} code=${serviceCode || '-'} phone=${phoneNumber || '-'} text=${JSON.stringify(text || '')} hop=${hop}`,
  );

  return { response, hop };
}

export async function handleUssdNotification(payload) {
  const sessionId = payload.sessionId || payload.session_id || null;
  const phoneNumber = payload.phoneNumber || payload.phone_number || null;
  const status = payload.status || null;
  const hopsMetadata = payload.hopsMetadata || payload.hops_metadata || null;
  const errorMessage = payload.errorMessage || payload.error_message || null;

  await query(
    `INSERT INTO ussd_notifications (
        occurred_at, session_id, service_code, network_code, phone_number,
        status, cost, duration_ms, hops_count, hops_metadata, input,
        last_app_response, error_message
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      payload.date || null,
      sessionId,
      payload.serviceCode || payload.service_code || null,
      payload.networkCode || payload.network_code || null,
      phoneNumber,
      status,
      payload.cost || null,
      payload.durationInMillis || payload.duration_in_millis || null,
      payload.hopsCount === undefined || payload.hopsCount === ''
        ? null
        : Number.parseInt(payload.hopsCount, 10),
      hopsMetadata,
      payload.input || null,
      payload.lastAppResponse || payload.last_app_response || null,
      errorMessage,
    ],
  );

  const summary = [
    `USSD session ${status || 'ended'}`,
    phoneNumber ? `for ${phoneNumber}` : null,
    sessionId ? `(${sessionId})` : null,
    hopsMetadata ? `hops: ${hopsMetadata}` : null,
    errorMessage ? `error: ${errorMessage}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  await logEvent({
    type: 'USSD',
    message: summary,
  });

  return { ok: true };
}

export const DEMO_USSD_PHONES = [
  { phone: '256787106109', label: 'Sandbox simulator (SMS + USSD)' },
  { phone: '256700000002', label: 'Mukono B subscriber (USSD map only)' },
];
