import { query } from '../../db/pool.js';
import { activeIncidentForArea, markInvestigating } from '../incidents/index.js';
import { nextReference } from '../incidents/index.js';
import { logEvent } from '../../services/events.js';
import { sendSms } from '../../integrations/africastalking/sms.js';

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d]/g, '').replace(/^0/, '256');
}

export function parseUssdParts(text) {
  return String(text ?? '')
    .trim()
    .split('*')
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

/** @deprecated kept for tests — customer menu hops only */
export function classifyUssdText(text) {
  const parts = parseUssdParts(text);
  if (parts.length === 0) return { hop: 'menu', choice: null };
  const last = parts[parts.length - 1] || '';
  if (last === '1') return { hop: 'checkStatus', choice: '1' };
  if (last === '2') return { hop: 'reportProblem', choice: '2' };
  return { hop: 'invalid', choice: last || null };
}

export function normalizeIncidentReference(raw) {
  let cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!cleaned) return '';
  if (/^IB-\d+$/.test(cleaned)) return cleaned;
  if (/^IB\d+$/.test(cleaned)) return `IB-${cleaned.slice(2)}`;
  if (/^\d+$/.test(cleaned)) return `IB-${cleaned}`;
  return cleaned;
}

let lastCallback = null;

export function getLastUssdCallback() {
  return lastCallback;
}

export async function findTechnicianByPhone(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  const result = await query(
    `SELECT id, name, role, phone, team, active
     FROM technicians
     WHERE COALESCE(active, true) = true
       AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
     ORDER BY CASE WHEN role = 'NOC' THEN 0 ELSE 1 END, name
     LIMIT 1`,
    [normalized],
  );
  return result.rows[0] || null;
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

/**
 * Role resolution: technician phones win over customer records
 * (e.g. Matthew is NOC and may also appear as a demo subscriber).
 */
export async function resolveCaller(phone) {
  const technician = await findTechnicianByPhone(phone);
  if (technician) {
    return { role: 'TECHNICIAN', technician, customer: null };
  }
  const customer = await findCustomerByPhone(phone);
  if (customer) {
    return { role: 'CUSTOMER', technician: null, customer };
  }
  return { role: 'UNKNOWN', technician: null, customer: null };
}

export async function resolveSubscriber(phone) {
  const existing = await findCustomerByPhone(phone);
  if (existing) return existing;

  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const area = await query(
    `SELECT id, name, code FROM service_areas
     ORDER BY CASE WHEN code = 'SITE_MUKONO_CENTRAL' THEN 0 ELSE 1 END, name
     LIMIT 1`,
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

async function statusMessage(customer) {
  if (!customer) {
    return 'This phone number is not registered as a customer account.';
  }
  const incident = await activeIncidentForArea(customer.service_area_id);
  if (incident) {
    const investigating =
      incident.status === 'INVESTIGATING' ? 'is investigating' : 'has been notified';
    return `A known network incident is currently affecting your service area. Our technical team ${investigating}. Ref: ${incident.reference}.`;
  }
  return 'No known network incident is currently affecting your service area. Connectivity looks normal.';
}

async function reportProblem(customer, phone) {
  if (!customer) {
    return 'This phone number is not registered as a customer account.';
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

async function findOpenIncidentByReference(rawRef) {
  const reference = normalizeIncidentReference(rawRef);
  if (!reference) return null;
  const result = await query(
    `SELECT i.*, t.name AS technician_name, t.phone AS technician_phone
     FROM incidents i
     LEFT JOIN technicians t ON t.id = i.assigned_technician_id
     WHERE UPPER(i.reference) = $1 AND i.status <> 'RESOLVED'
     LIMIT 1`,
    [reference],
  );
  return result.rows[0] || null;
}

async function listTechnicianOpenIncidents(technician) {
  const result = await query(
    `SELECT reference, title, status, failure_domain
     FROM incidents
     WHERE status <> 'RESOLVED'
       AND (
         assigned_technician_id = $1
         OR ($2 = 'NOC')
       )
     ORDER BY detected_at DESC
     LIMIT 5`,
    [technician.id, technician.role],
  );
  return result.rows;
}

async function acknowledgeIncident(technician, rawRef) {
  const reference = normalizeIncidentReference(rawRef);
  if (!reference) {
    return 'END Enter a valid incident reference, e.g. IB-1056.';
  }

  const incident = await findOpenIncidentByReference(reference);
  if (!incident) {
    return `END No open incident found for ${reference}. Check the SMS reference and try again.`;
  }

  const isAssignee = incident.assigned_technician_id === technician.id;
  const isNoc = technician.role === 'NOC';
  if (!isAssignee && !isNoc) {
    await logEvent({
      type: 'USSD',
      message: `Technician ${technician.name} denied ack for ${incident.reference} (not assigned)`,
      incidentId: incident.id,
    });
    return `END ${incident.reference} is not assigned to your account. Contact NOC if you need it reassigned.`;
  }

  if (incident.status === 'INVESTIGATING') {
    return `END ${incident.reference} is already marked investigating. Thank you.`;
  }

  const updated = await markInvestigating(incident.id);
  if (!updated) {
    return `END Could not update ${incident.reference}. It may already be resolved.`;
  }

  await logEvent({
    type: 'ASSIGNMENT',
    message: `${technician.name} acknowledged ${incident.reference} via USSD — now investigating`,
    incidentId: incident.id,
  });

  return `END Acknowledged. You are responding to ${incident.reference}. Status set to INVESTIGATING.`;
}

async function handleCustomerUssd(parts, phoneNumber) {
  if (parts.length === 0) {
    return {
      hop: 'customer_menu',
      response: 'CON IncidentBridge Customer\n1. Check my service status\n2. Report a problem',
    };
  }

  const choice = parts[0];
  if (choice === '3' || choice.toLowerCase().includes('ack') || choice.toLowerCase().startsWith('ib')) {
    return {
      hop: 'customer_denied_tech',
      response:
        'END Technician incident response is not available on customer accounts. Dial again and choose 1 or 2.',
    };
  }

  const customer = (await findCustomerByPhone(phoneNumber)) || (await resolveSubscriber(phoneNumber));

  if (choice === '1') {
    return { hop: 'checkStatus', response: `END ${await statusMessage(customer)}` };
  }
  if (choice === '2') {
    return { hop: 'reportProblem', response: `END ${await reportProblem(customer, phoneNumber)}` };
  }

  return {
    hop: 'invalid',
    response: 'END Invalid selection. Dial again and choose 1 or 2.',
  };
}

async function handleTechnicianUssd(parts, technician) {
  if (parts.length === 0) {
    return {
      hop: 'technician_menu',
      response:
        'CON IncidentBridge Technician\n1. Acknowledge incident\n2. My open assignments\n0. Exit',
    };
  }

  const choice = parts[0];

  if (choice === '0') {
    return { hop: 'exit', response: 'END Goodbye.' };
  }

  // Customer-style options blocked for tech accounts on this shortcode menu
  if (choice === '9') {
    return {
      hop: 'tech_denied_customer',
      response: 'END Customer service options are on the subscriber menu. Use 1 to acknowledge an incident.',
    };
  }

  if (choice === '1') {
    if (parts.length === 1) {
      return {
        hop: 'prompt_reference',
        response: 'CON Enter incident reference from SMS\n(e.g. IB-1056 or 1056)',
      };
    }
    return {
      hop: 'acknowledge',
      response: await acknowledgeIncident(technician, parts.slice(1).join('')),
    };
  }

  if (choice === '2') {
    const open = await listTechnicianOpenIncidents(technician);
    if (open.length === 0) {
      return { hop: 'list_assignments', response: 'END You have no open assigned incidents.' };
    }
    const lines = open.map((item, index) => `${index + 1}. ${item.reference} ${item.status}`);
    return {
      hop: 'list_assignments',
      response: `END Open assignments:\n${lines.join('\n')}\nDial again → 1 to acknowledge.`,
    };
  }

  return {
    hop: 'invalid',
    response: 'END Invalid selection. Dial again and choose 1 or 2.',
  };
}

export async function handleUssd({ sessionId, serviceCode, phoneNumber, text }) {
  const parts = parseUssdParts(text);
  const caller = await resolveCaller(phoneNumber);

  let hop;
  let response;

  if (caller.role === 'TECHNICIAN') {
    ({ hop, response } = await handleTechnicianUssd(parts, caller.technician));
  } else if (caller.role === 'CUSTOMER' || caller.role === 'UNKNOWN') {
    // Unknown numbers are treated as customers for demo (auto-register on status/report)
    ({ hop, response } = await handleCustomerUssd(parts, phoneNumber));
  } else {
    hop = 'unknown';
    response = 'END Unable to resolve this phone account.';
  }

  lastCallback = {
    at: new Date().toISOString(),
    sessionId: sessionId || null,
    serviceCode: serviceCode || null,
    phoneNumber: phoneNumber || null,
    text: text ?? '',
    role: caller.role,
    hop,
    response,
  };

  console.log(
    `[ussd] role=${caller.role} session=${sessionId || '-'} phone=${phoneNumber || '-'} text=${JSON.stringify(text || '')} hop=${hop}`,
  );

  return { response, hop, role: caller.role };
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

/** Live demo picker: all active technicians + one customer per site. */
export async function listDemoUssdPhones() {
  const technicians = await query(
    `SELECT name, role, team,
            regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') AS phone
     FROM technicians
     WHERE COALESCE(active, true) = true
       AND phone IS NOT NULL
       AND length(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')) >= 9
     ORDER BY CASE WHEN role = 'NOC' THEN 0 ELSE 1 END, name`,
  );
  const customers = await query(
    `SELECT DISTINCT ON (sa.id)
            regexp_replace(c.phone, '[^0-9]', '', 'g') AS phone,
            sa.name AS area_name
     FROM customers c
     JOIN service_areas sa ON sa.id = c.service_area_id
     WHERE c.phone IS NOT NULL AND length(regexp_replace(c.phone, '[^0-9]', '', 'g')) >= 9
     ORDER BY sa.id, c.reference
     LIMIT 12`,
  );

  const seen = new Set();
  const phones = [];

  for (const row of technicians.rows) {
    if (!row.phone || seen.has(row.phone)) continue;
    seen.add(row.phone);
    const site = row.team ? ` (${row.team})` : '';
    phones.push({
      phone: row.phone,
      label: `Technician · ${row.name}${site}`,
      role: 'TECHNICIAN',
    });
  }

  for (const row of customers.rows) {
    if (!row.phone || seen.has(row.phone)) continue;
    seen.add(row.phone);
    phones.push({
      phone: row.phone,
      label: `Customer · ${row.area_name}`,
      role: 'CUSTOMER',
    });
  }

  return phones;
}

/** @deprecated static fallback — prefer listDemoUssdPhones() */
export const DEMO_USSD_PHONES = [];
