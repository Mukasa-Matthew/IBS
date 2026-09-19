import { Activity, Radio } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

interface Props {
  networkStatus: string;
  generatedAt?: string;
}

export function Header({ networkStatus, generatedAt }: Props) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#1e2a38] bg-[#121a24] px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-md border border-[#2a3b4d] bg-[#0b1118]">
          <Activity className="h-5 w-5 text-sky-300" />
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">IncidentBridge</h1>
            <span className="rounded border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-sky-200">
              Simulation mode
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Distributed Network Incident Detection &amp; Response
          </p>
          <p className="mt-1 text-xs text-slate-500">Detect. Localize. Route. Inform.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Radio className="h-3.5 w-3.5" />
          Telemetry simulated
        </div>
        <StatusBadge label={`Network ${networkStatus}`} value={networkStatus} />
        {generatedAt ? (
          <span className="font-mono text-xs text-slate-500">{new Date(generatedAt).toLocaleString()}</span>
        ) : null}
      </div>
    </header>
  );
}
