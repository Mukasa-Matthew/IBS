import type { Dashboard, TopologyLink, TopologyNode } from '../types';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

function apiUrl(path: string) {
  if (!path.startsWith('/')) return `${API_BASE}/${path}`;
  return `${API_BASE}${path}`;
}

export async function fetchDashboard(): Promise<Dashboard> {
  const response = await fetch(apiUrl('/api/dashboard'));
  if (!response.ok) throw new Error('Failed to load dashboard');
  return response.json();
}

export async function applyScenario(scenario: string) {
  const response = await fetch(apiUrl('/api/simulation/scenario'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to apply scenario');
  }
  return response.json();
}

export async function markInvestigating(id: string) {
  const response = await fetch(apiUrl(`/api/incidents/${id}/investigate`), { method: 'POST' });
  if (!response.ok) throw new Error('Unable to update incident status');
  return response.json();
}

export async function sendUssd(phoneNumber: string, text: string) {
  const response = await fetch(apiUrl('/api/ussd'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, text, sessionId: 'demo' }),
  });
  if (!response.ok) throw new Error('USSD request failed');
  return response.text();
}

export interface UssdDemoPhone {
  phone: string;
  label: string;
  role: 'CUSTOMER' | 'TECHNICIAN' | string;
}

export async function listUssdDemoPhones(): Promise<UssdDemoPhone[]> {
  const response = await fetch(apiUrl('/api/ussd/demo-phones'));
  if (!response.ok) throw new Error('Failed to load USSD demo phones');
  return response.json();
}

export interface SimulationScenario {
  id: string;
  label: string;
}

export async function listSimulationScenarios(): Promise<SimulationScenario[]> {
  const response = await fetch(apiUrl('/api/simulation/scenarios'));
  if (!response.ok) throw new Error('Failed to load simulation scenarios');
  return response.json();
}

export async function listTechnicians() {
  const response = await fetch(apiUrl('/api/technicians'));
  if (!response.ok) throw new Error('Failed to load technicians');
  return response.json();
}

export async function createTechnician(payload: Record<string, unknown>) {
  const response = await fetch(apiUrl('/api/technicians'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to create technician');
  return body;
}

export async function updateTechnician(id: string, payload: Record<string, unknown>) {
  const response = await fetch(apiUrl(`/api/technicians/${id}`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to update technician');
  return body;
}

export async function setTechnicianStatus(id: string, active: boolean) {
  const response = await fetch(apiUrl(`/api/technicians/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ active }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to update status');
  return body;
}

export async function listServiceAreas() {
  const response = await fetch(apiUrl('/api/service-areas'));
  if (!response.ok) throw new Error('Failed to load service areas');
  return response.json();
}

export async function setAreaTechnicians(
  areaId: string,
  assignments: Array<{ technician_id: string; priority: 'PRIMARY' | 'BACKUP' }>,
) {
  const response = await fetch(apiUrl(`/api/service-areas/${areaId}/technicians`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assignments }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Failed to save assignments');
  return body;
}

export async function sendTestSms(to: string, message: string) {
  const response = await fetch(apiUrl('/api/sms/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || body.error || 'SMS failed');
  return body;
}

export type { TopologyLink, TopologyNode };
