import { Users, Wifi, WifiOff } from 'lucide-react';
import type { ServiceArea } from '../types';

interface Props {
  areas: ServiceArea[];
  className?: string;
}

function isOffline(area: ServiceArea) {
  return area.health_state === 'FAILURE' || area.health_state === 'UNKNOWN';
}

function isDegraded(area: ServiceArea) {
  return area.health_state === 'DEGRADED';
}

export function CustomerStatusCard({ areas, className = '' }: Props) {
  const total = areas.reduce((sum, area) => sum + (area.customer_count || 0), 0);
  const offline = areas
    .filter(isOffline)
    .reduce((sum, area) => sum + (area.customer_count || 0), 0);
  const degraded = areas
    .filter(isDegraded)
    .reduce((sum, area) => sum + (area.customer_count || 0), 0);
  const active = Math.max(0, total - offline);
  const activePct = total ? Math.round((active / total) * 100) : 100;
  const offlinePct = total ? Math.round((offline / total) * 100) : 0;

  return (
    <section
      className={`rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_rgba(9,115,63,0.08)] ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">Customer reachability</p>
          <p className="mt-1 text-xs text-muted">
            Active vs offline across {areas.length} sites
            {degraded > 0 ? ` · ${degraded} degraded (still counted active)` : ''}
          </p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-deep">
          <Users className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-brand/25 bg-brand-soft p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand">
            <Wifi className="h-3.5 w-3.5" />
            Active
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-brand">{active}</p>
          <p className="mt-1 text-xs text-brand">{activePct}% of fleet</p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            offline > 0 ? 'border-fail/30 bg-fail/10' : 'border-line bg-surface-2'
          }`}
        >
          <p
            className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${
              offline > 0 ? 'text-fail' : 'text-muted'
            }`}
          >
            <WifiOff className="h-3.5 w-3.5" />
            Offline
          </p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight ${offline > 0 ? 'text-fail' : 'text-ink'}`}>
            {offline}
          </p>
          <p className={`mt-1 text-xs ${offline > 0 ? 'text-fail' : 'text-muted'}`}>{offlinePct}% of fleet</p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-surface-2">
        <div className="flex h-full w-full">
          <div className="h-full bg-brand transition-all duration-500" style={{ width: `${activePct}%` }} />
          <div className="h-full bg-fail transition-all duration-500" style={{ width: `${offlinePct}%` }} />
        </div>
      </div>

      <div className="mt-4 max-h-40 space-y-2 overflow-y-auto">
        {areas.map((area) => {
          const offlineSite = isOffline(area);
          return (
            <div
              key={area.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-xs"
            >
              <div>
                <p className="font-medium text-ink">{area.name}</p>
                <p className="text-muted">{area.technician_name || 'Unassigned'}</p>
              </div>
              <div className="text-right">
                <p className={`font-mono font-semibold ${offlineSite ? 'text-fail' : 'text-brand'}`}>
                  {area.customer_count}
                </p>
                <p className={offlineSite ? 'text-fail' : 'text-muted'}>
                  {offlineSite ? 'offline' : isDegraded(area) ? 'degraded' : 'active'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
