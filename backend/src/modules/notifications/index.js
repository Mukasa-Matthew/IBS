import { sendSms } from '../../integrations/africastalking/sms.js';
import { displayNameForDomain } from '../localization/engine.js';
import { impactStatement } from '../impact/index.js';

export function shouldNotify(severity) {
  return severity === 'HIGH' || severity === 'CRITICAL';
}

export function composeIncidentSms({ reference, title, customerCount, domain }) {
  return [
    `IncidentBridge ${reference}`,
    '',
    title.endsWith('.') ? title : `${title}.`,
    impactStatement(customerCount),
    '',
    `Failure domain: ${displayNameForDomain(domain)}.`,
    '',
    'Please investigate.',
  ].join('\n');
}

export async function notifyTechnician({ technician, incident }) {
  if (!technician?.phone) {
    return { status: 'FAILED', detail: 'Assigned technician has no phone number' };
  }
  if (!shouldNotify(incident.severity)) {
    return { status: 'SKIPPED', detail: `${incident.severity} incidents do not trigger SMS` };
  }

  const result = await sendSms({
    to: technician.phone,
    message: composeIncidentSms({
      reference: incident.reference,
      title: incident.title,
      customerCount: incident.potentially_affected_customer_count,
      domain: incident.failure_domain,
    }),
    purpose: 'technician_alert',
    incidentId: incident.id,
  });
  return result;
}
