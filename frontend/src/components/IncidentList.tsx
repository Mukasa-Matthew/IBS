import type { Incident } from '../types';
import { formatClock, formatDuration } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { markInvestigating } from '../services/api';

interface Props {
  incidents: Incident[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function IncidentList({ incidents, selectedId, onSelect }: Props) {
  const visible = incidents.slice(0, 8);

  return (
    <section className="flex h-full min-h-[280px] flex-col rounded-lg border border-[#1e2a38] bg-[#121a24] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide">Incidents</h2>
        <span className="text-xs text-slate-500">{incidents.filter((item) => item.status !== 'RESOLVED').length} active</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-auto pr-1">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-500">No incidents detected.</p>
        ) : (
          visible.map((incident) => {
            const selected = incident.id === selectedId;
            return (
              <article
                key={incident.id}
                onClick={() => onSelect(incident.id)}
                className={`cursor-pointer rounded-lg border p-3 text-left transition ${
                  selected ? 'border-sky-400/40 bg-[#172333]' : 'border-[#1e2a38] bg-[#0b1118] hover:border-[#33465c]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm text-sky-200">{incident.reference}</p>
                  <div className="flex gap-1.5">
                    <StatusBadge label={incident.severity} value={incident.severity} />
                    <StatusBadge label={incident.status} value={incident.status} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-100">{incident.title}</p>
                <div className="mt-2 grid gap-1 text-xs text-slate-400">
                  <p>{incident.area_names.join(', ')}</p>
                  <p>{incident.failure_domain_label}</p>
                  <p>{incident.impact_statement}</p>
                  <p>Assigned: {incident.assigned_technician?.name || 'Unassigned'}</p>
                  <p>
                    Detected {formatClock(incident.detected_at)}
                    {incident.resolved_at
                      ? ` · Resolved ${formatClock(incident.resolved_at)} · Duration ${formatDuration(incident.duration_ms)}`
                      : ` · Duration ${formatDuration(incident.duration_ms)}`}
                  </p>
                  <p>
                    SMS:{' '}
                    <span className="text-slate-200">{incident.notification_status}</span>
                  </p>
                </div>
                {incident.status === 'ASSIGNED' ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      markInvestigating(incident.id).catch((error) => console.error(error));
                    }}
                    className="mt-2 inline-flex rounded border border-[#2a3b4d] px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    Begin investigation
                  </button>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
