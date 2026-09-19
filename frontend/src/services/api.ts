import type { Dashboard } from '../types';

export async function fetchDashboard(): Promise<Dashboard> {
  const response = await fetch('/api/dashboard');
  if (!response.ok) throw new Error('Failed to load dashboard');
  return response.json();
}

export async function applyScenario(scenario: string) {
  const response = await fetch('/api/simulation/scenario', {
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
  const response = await fetch(`/api/incidents/${id}/investigate`, { method: 'POST' });
  if (!response.ok) throw new Error('Unable to update incident status');
  return response.json();
}

export async function sendUssd(phoneNumber: string, text: string) {
  const response = await fetch('/api/ussd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber, text, sessionId: 'demo' }),
  });
  if (!response.ok) throw new Error('USSD request failed');
  return response.text();
}
