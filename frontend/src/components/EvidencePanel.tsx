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
      <section className="flex h-full min-h-[280px] flex-col rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_rgba(20,32,26,0.06)]">
        <h2 className="text-sm font-semibold tracking-wide text-ink">Evidence</h2>
        <p className="mt-6 text-sm text-muted">Select an incident to inspect observed facts and interpretation.</p>
      </section>
    );
  }

  const facts = incident.evidence?.facts || [];

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-3xl border border-line bg-surface p-5 shadow-[0_18px_40px_rgba(20,32,26,0.06)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-wide text-ink">Evidence</h2>
        <StatusBadge label={incident.reference} />
      </div>

      <div className="rounded-2xl border border-line bg-surface-2 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Facts</p>
        <ul className="mt-2 grid gap-2">
          {facts.map((fact) => (
            <li key={fact.key} className="flex items-start gap-2 text-sm">
              {fact.ok ? (
                <Check className="mt-0.5 h-4 w-4 text-brand" />
              ) : (
                <X className="mt-0.5 h-4 w-4 text-[#8f1f1f]" />
              )}
              <span className={fact.ok ? 'text-ink' : 'text-[#8f1f1f]'}>{fact.text}</span>
            </li>
          ))}
          {facts.length === 0 ? (
            <li className="flex items-center gap-2 text-sm text-muted">
              <Minus className="h-4 w-4" />
              No facts recorded
            </li>
          ) : null}
        </ul>
      </div>

      <div className="mt-3 rounded-2xl border border-[#f0d7a2] bg-[#fff8eb] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8a5a12]">Interpretation</p>
        <p className="mt-2 text-sm text-ink">{incident.evidence?.inference || incident.explanation}</p>
        <p className="mt-2 text-xs leading-5 text-muted">
          IncidentBridge localizes a failure domain from reachability evidence. It does not claim a physical root cause.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
        <div>
          <p>Detected</p>
          <p className="font-mono text-ink">{formatClock(incident.detected_at)}</p>
        </div>
        <div>
          <p>Resolved</p>
          <p className="font-mono text-ink">
            {incident.resolved_at ? formatClock(incident.resolved_at) : 'Open'}
          </p>
        </div>
        <div>
          <p>Duration</p>
          <p className="font-mono text-ink">{formatDuration(incident.duration_ms)}</p>
        </div>
      </div>
    </section>
  );
}
