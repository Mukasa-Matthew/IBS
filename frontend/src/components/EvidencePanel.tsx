import { Check, Minus, X } from 'lucide-react';
import type { Incident } from '../types';
import { formatClock, formatDuration } from '../lib/format';
import { StatusBadge } from './StatusBadge';

interface Props {
  incident: Incident | null;
}

export function EvidencePanel({ incident }: Props) {
  if (!incident) {
    return (
      <section className="flex h-full min-h-[280px] flex-col rounded-xl border border-[#1e2a38] bg-[#121a24] p-5">
        <h2 className="text-sm font-semibold tracking-wide">Evidence</h2>
        <p className="mt-6 text-sm text-slate-500">Select an incident to inspect observed facts and interpretation.</p>
      </section>
    );
  }

  const facts = incident.evidence?.facts || [];

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-xl border border-[#1e2a38] bg-[#121a24] p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide">Evidence</h2>
        <StatusBadge label={incident.reference} />
      </div>

      <div className="rounded-lg border border-[#1e2a38] bg-[#0b1118] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Facts</p>
        <ul className="mt-2 grid gap-2">
          {facts.map((fact) => (
            <li key={fact.key} className="flex items-start gap-2 text-sm">
              {fact.ok ? (
                <Check className="mt-0.5 h-4 w-4 text-emerald-300" />
              ) : (
                <X className="mt-0.5 h-4 w-4 text-rose-300" />
              )}
              <span className={fact.ok ? 'text-slate-200' : 'text-rose-100'}>{fact.text}</span>
            </li>
          ))}
          {facts.length === 0 ? (
            <li className="flex items-center gap-2 text-sm text-slate-500">
              <Minus className="h-4 w-4" />
              No facts recorded
            </li>
          ) : null}
        </ul>
      </div>

      <div className="mt-3 rounded-lg border border-amber-400/20 bg-[#17140d] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300/80">Interpretation</p>
        <p className="mt-2 text-sm text-amber-50">{incident.evidence?.inference || incident.explanation}</p>
        <p className="mt-2 text-xs leading-5 text-slate-400">
          IncidentBridge localizes a failure domain from reachability evidence. It does not claim a physical root cause.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div>
          <p className="text-slate-500">Detected</p>
          <p className="font-mono text-slate-200">{formatClock(incident.detected_at)}</p>
        </div>
        <div>
          <p className="text-slate-500">Resolved</p>
          <p className="font-mono text-slate-200">
            {incident.resolved_at ? formatClock(incident.resolved_at) : 'Open'}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Duration</p>
          <p className="font-mono text-slate-200">{formatDuration(incident.duration_ms)}</p>
        </div>
      </div>
    </section>
  );
}
