import { Globe, Radio, Server, Users, Wifi, WifiOff } from 'lucide-react';
import type { ServiceArea } from '../types';
import { StatusBadge } from './StatusBadge';
import { Sparkline } from './LiveCharts';

interface Props {
  area: ServiceArea;
  scoreSeries?: number[];
}

function Probe({ ok, label }: { ok: boolean | null; label: string }) {
  const Icon = ok === false ? WifiOff : Wifi;
  const text = ok === null ? 'UNKNOWN' : ok ? 'UP' : 'DOWN';
  const color = ok === null ? 'text-muted' : ok ? 'text-brand' : 'text-[#8f1f1f]';
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-surface-2 px-3 py-2">
      <span className={`flex items-center gap-2 text-sm ${color}`}>
        <Icon className="h-4 w-4" />
        {label}
      </span>
      <span className={`text-xs font-medium ${color}`}>{text}</span>
    </div>
  );
}

export function ServiceAreaCard({ area, scoreSeries = [] }: Props) {
  const obs = area.observation;
  const oobActive = area.oob_status === 'ACTIVE_SIMULATED_CELLULAR';
  const series =
    scoreSeries.length > 1
      ? scoreSeries
      : area.health_state === 'HEALTHY'
        ? [92, 94, 95, 96, 97]
        : area.health_state === 'DEGRADED'
          ? [80, 72, 65, 60, 58]
          : [40, 28, 22, 18, 15];

  return (
    <article className="flex h-full flex-col rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_rgba(20,32,26,0.06)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink">{area.name}</h3>
          <p className="mt-1 text-xs text-muted">{area.site_name || `${area.name} site rack`}</p>
          <p className="mt-1 flex items-center gap-2 text-xs text-muted">
            <Users className="h-3.5 w-3.5" />
            {area.customer_count} customers · {area.access_device_name || 'OLT'}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge label={area.health_state} value={area.health_state} />
          <Sparkline values={series} className="mt-2 h-8 w-24" />
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-muted">
        <p className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          {area.agent_name}
        </p>
        <p className="flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" />
          {area.technician_name || 'Unassigned'}
        </p>
      </div>
      {(area.technicians || []).length > 0 ? (
        <p className="mb-3 text-[11px] text-muted">
          {(area.technicians || [])
            .map((tech) => `${tech.priority}: ${tech.name}`)
            .join(' · ')}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Probe ok={obs ? obs.local_access_reachable : null} label="Local access" />
        <Probe ok={obs ? obs.core_reachable : null} label="Core reachability" />
        <Probe ok={obs ? obs.internet_reachable : null} label="Internet reachability" />
      </div>

      <div className="mt-3 grid gap-2 text-xs">
        <div className="rounded-2xl border border-line px-3 py-2">
          <p className="text-muted">Primary path</p>
          <p className={area.primary_path_status === 'AVAILABLE' ? 'text-brand' : 'text-[#8f1f1f]'}>
            {area.primary_path_label}
          </p>
        </div>
        <div
          className={`rounded-2xl border px-3 py-2 ${
            oobActive ? 'border-[#8fa89a] bg-brand-soft' : 'border-line'
          }`}
        >
          <p className="flex items-center gap-1.5 text-muted">
            <Globe className="h-3.5 w-3.5" />
            Out-of-band reporting
          </p>
          <p className={oobActive ? 'text-brand' : 'text-ink'}>{area.oob_label}</p>
          {oobActive ? (
            <p className="mt-1 text-[11px] text-brand">Simulated cellular fallback — not physical GSM hardware</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
