import { Globe, Radio, Server, Users, Wifi, WifiOff } from 'lucide-react';
import type { ServiceArea } from '../types';
import { StatusBadge } from './StatusBadge';

interface Props {
  area: ServiceArea;
}

function Probe({ ok, label }: { ok: boolean | null; label: string }) {
  const Icon = ok === false ? WifiOff : Wifi;
  const text = ok === null ? 'UNKNOWN' : ok ? 'UP' : 'DOWN';
  const color = ok === null ? 'text-slate-400' : ok ? 'text-emerald-300' : 'text-rose-300';
  return (
    <div className="flex items-center justify-between rounded border border-[#1e2a38] bg-[#0b1118] px-3 py-2">
      <span className="flex items-center gap-2 text-sm text-slate-300">
        <Icon className={`h-4 w-4 ${color}`} />
        {label}
      </span>
      <span className={`text-xs font-medium ${color}`}>{text}</span>
    </div>
  );
}

export function ServiceAreaCard({ area }: Props) {
  const obs = area.observation;
  const oobActive = area.oob_status === 'ACTIVE_SIMULATED_CELLULAR';

  return (
    <article className="flex h-full flex-col rounded-xl border border-[#1e2a38] bg-[#121a24] p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">{area.name}</h3>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
            <Users className="h-3.5 w-3.5" />
            {area.customer_count} customers
          </p>
        </div>
        <StatusBadge label={area.health_state} value={area.health_state} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 text-xs text-slate-400">
        <p className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5" />
          {area.agent_name}
        </p>
        <p className="flex items-center gap-1.5">
          <Server className="h-3.5 w-3.5" />
          {area.technician_name}
        </p>
      </div>

      <div className="grid gap-2">
        <Probe ok={obs ? obs.local_access_reachable : null} label="Local access" />
        <Probe ok={obs ? obs.core_reachable : null} label="Core reachability" />
        <Probe ok={obs ? obs.internet_reachable : null} label="Internet reachability" />
      </div>

      <div className="mt-3 grid gap-2 text-xs">
        <div className="rounded border border-[#1e2a38] px-3 py-2">
          <p className="text-slate-500">Primary path</p>
          <p className={area.primary_path_status === 'AVAILABLE' ? 'text-emerald-300' : 'text-rose-300'}>
            {area.primary_path_label}
          </p>
        </div>
        <div className={`rounded border px-3 py-2 ${oobActive ? 'border-sky-400/30 bg-sky-400/5' : 'border-[#1e2a38]'}`}>
          <p className="flex items-center gap-1.5 text-slate-500">
            <Globe className="h-3.5 w-3.5" />
            Out-of-band reporting
          </p>
          <p className={oobActive ? 'text-sky-200' : 'text-slate-300'}>{area.oob_label}</p>
          {oobActive ? (
            <p className="mt-1 text-[11px] text-sky-300/80">Simulated cellular fallback — not physical GSM hardware</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
