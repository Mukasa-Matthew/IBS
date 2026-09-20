import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { EvidencePanel } from '../components/EvidencePanel';
import { StatusBadge } from '../components/StatusBadge';
import { SmsStatus } from '../components/SmsStatus';
import { MetricCard } from '../components/LiveCharts';
import { formatClock, formatDuration } from '../lib/format';
import { markInvestigating } from '../services/api';
import type { Incident } from '../types';

const FILTERS = ['ACTIVE', 'ALL', 'RESOLVED'] as const;

export function IncidentsPage() {
  const { dashboard, history } = useDashboard();
  const { incidentId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ACTIVE');

  const incidents = useMemo(() => {
    if (!dashboard) return [];
    if (filter === 'ACTIVE') return dashboard.incidents.filter((item) => item.status !== 'RESOLVED');
    if (filter === 'RESOLVED') return dashboard.incidents.filter((item) => item.status === 'RESOLVED');
    return dashboard.incidents;
  }, [dashboard, filter]);

  const selected = useMemo(() => {
    if (!dashboard) return null;
    return (
      dashboard.incidents.find((item) => item.id === incidentId) ||
      incidents[0] ||
      dashboard.incidents[0] ||
      null
    );
  }, [dashboard, incidentId, incidents]);

  if (!dashboard) return null;

  const incidentSeries = history.map((item) => item.activeIncidents * 20);
  const customerSeries = history.map((item) => Math.min(100, item.affectedCustomers));

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Incidents"
        description="Failure-domain localization, impact, technician routing, and notification status."
        actions={
          <div className="flex rounded-full border border-line bg-surface p-1">
            {FILTERS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3 py-1 text-xs ${
                  filter === item ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {item === 'ACTIVE' ? 'Active' : item === 'ALL' ? 'All' : 'Resolved'}
              </button>
            ))}
          </div>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2">
        <MetricCard
          label="Open incident load"
          value={String(dashboard.active_incidents.length)}
          delta={`${dashboard.summary?.potentially_affected_customers ?? 0} customers potentially affected`}
          deltaPositive={dashboard.active_incidents.length === 0}
          tone={dashboard.active_incidents.length === 0 ? 'forest' : 'rose'}
          series={incidentSeries.length ? incidentSeries : [0, 0, 5, 10, 20, 20]}
        />
        <MetricCard
          label="Impact pressure"
          value={String(dashboard.summary?.potentially_affected_customers ?? 0)}
          delta="Tracks simulation failure accumulation"
          deltaPositive={(dashboard.summary?.potentially_affected_customers ?? 0) === 0}
          tone={(dashboard.summary?.potentially_affected_customers ?? 0) === 0 ? 'violet' : 'rose'}
          series={customerSeries.length ? customerSeries : [0, 0, 10, 30, 50, 67]}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <Panel className="lg:col-span-7" title="Incident register" subtitle={`${incidents.length} shown`}>
          <div className="overflow-x-auto">
            {incidents.length === 0 ? (
              <p className="text-sm text-muted">No incidents in this view.</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="whitespace-nowrap pb-3 pr-4 font-medium">Reference</th>
                    <th className="whitespace-nowrap pb-3 pr-4 font-medium">Summary</th>
                    <th className="whitespace-nowrap pb-3 pr-4 font-medium">Severity</th>
                    <th className="whitespace-nowrap pb-3 pr-4 font-medium">Status</th>
                    <th className="whitespace-nowrap pb-3 font-medium">SMS</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      selected={incident.id === selected?.id}
                      onSelect={() => navigate(`/incidents/${incident.id}`)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
        <div className="lg:col-span-5">
          <EvidencePanel incident={selected} />
          {selected?.status === 'ASSIGNED' ? (
            <button
              type="button"
              onClick={() => markInvestigating(selected.id).catch((error) => console.error(error))}
              className="mt-3 rounded-full border border-line bg-surface px-4 py-2 text-sm text-brand hover:border-brand"
            >
              Begin investigation
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IncidentRow({
  incident,
  selected,
  onSelect,
}: {
  incident: Incident;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`cursor-pointer border-t border-line ${selected ? 'bg-brand-soft' : 'hover:bg-surface-2'}`}
    >
      <td className="py-3 align-top font-mono text-brand">{incident.reference}</td>
      <td className="py-3 align-top">
        <p className="text-ink">{incident.title}</p>
        <p className="mt-1 text-xs text-muted">
          {incident.area_names.join(', ')} · {incident.failure_domain_label} · {incident.impact_statement}
        </p>
        <p className="mt-1 text-xs text-muted">
          {incident.assigned_technician?.name || 'Unassigned'} · Detected {formatClock(incident.detected_at)}
          {incident.resolved_at ? ` · ${formatDuration(incident.duration_ms)}` : ''}
        </p>
      </td>
      <td className="py-3 align-top">
        <StatusBadge label={incident.severity} value={incident.severity} />
      </td>
      <td className="py-3 align-top">
        <StatusBadge label={incident.status} value={incident.status} />
      </td>
      <td className="py-3 align-top">
        <SmsStatus status={incident.notification_status} detail={incident.notification_detail} compact />
      </td>
    </tr>
  );
}
