export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour12: false });
}

export function formatDuration(ms: number | null | undefined) {
  if (ms == null) return '—';
  const total = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function stateTone(state: string) {
  const value = (state || '').toUpperCase();
  if (
    ['HEALTHY', 'AVAILABLE', 'SENT', 'DELIVERED', 'RESOLVED', 'ACTIVE', 'STANDBY', 'SUCCESS'].includes(value)
  ) {
    return 'ok';
  }
  if (
    ['DEGRADED', 'MEDIUM', 'ASSIGNED', 'SIMULATED', 'QUEUED', 'INVESTIGATING', 'LOW', 'PENDING'].includes(
      value,
    )
  ) {
    return 'warn';
  }
  if (
    ['FAILURE', 'FAILED', 'CRITICAL', 'HIGH', 'UNAVAILABLE', 'INCIDENT', 'DETECTED'].includes(
      value,
    )
  ) {
    return 'fail';
  }
  return 'neutral';
}

export function toneClasses(tone: string) {
  switch (tone) {
    case 'ok':
      return 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20';
    case 'warn':
      return 'text-amber-300 bg-amber-400/10 border-amber-400/20';
    case 'fail':
      return 'text-rose-300 bg-rose-400/10 border-rose-400/20';
    default:
      return 'text-slate-300 bg-slate-400/10 border-slate-400/20';
  }
}

export function toneHex(tone: string) {
  switch (tone) {
    case 'ok':
      return '#34d399'; /* bright on dark topology */
    case 'warn':
      return '#ef8d22';
    case 'fail':
      return '#f07167';
    default:
      return '#8fa89a';
  }
}
