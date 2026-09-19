import { Link } from 'react-router-dom';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { Topology } from '../components/Topology';
import { StatusBadge } from '../components/StatusBadge';
import { formatClock, formatDuration } from '../lib/format';

export function OverviewPage() {
  const { dashboard } = useDashboard();
  if (!dashboard) return null;

  const affectedCustomers = dashboard.active_incidents.reduce(
    (sum, incident) => sum + incident.potentially_affected_customer_count,
    0,
  );
  const latest = dashboard.active_incidents[0] || dashboard.incidents[0];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Operations"
        description="Current network health, active incidents, and the evidence behind routing decisions."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Network status" value={dashboard.network_status} badge={dashboard.network_status} />
        <Kpi label="Active incidents" value={String(dashboard.active_incidents.length)} />
        <Kpi
          label="Potentially affected"
          value={dashboard.active_incidents.length ? String(affectedCustomers) : '0'}
          hint="Customers in associated service areas"
        />
        <Kpi label="Active scenario" value={dashboard.simulation.label} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Topology nodes={dashboard.topology.nodes} links={dashboard.topology.links} />
        </div>
        <Panel
          className="lg:col-span-2"
          title="Active incidents"
          subtitle={`${dashboard.active_incidents.length} open`}
          actions={
            <Link to="/incidents" className="text-xs text-sky-300 hover:text-sky-200">
              View all
            </Link>
          }
        >
          {dashboard.active_incidents.length === 0 ? (
            <p className="text-sm text-slate-500">No active incidents. Network path observations are healthy.</p>
          ) : (
            <div className="grid gap-3">
              {dashboard.active_incidents.slice(0, 4).map((incident) => (
                <Link
                  key={incident.id}
                  to={`/incidents/${incident.id}`}
                  className="rounded-lg border border-[#1e2a38] bg-[#0b1118] p-3 hover:border-[#33465c]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-sm text-sky-200">{incident.reference}</p>
                    <StatusBadge label={incident.severity} value={incident.severity} />
                  </div>
                  <p className="mt-2 text-sm text-slate-100">{incident.title}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {incident.area_names.join(', ')} · {incident.impact_statement}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Service areas" actions={<Link to="/network" className="text-xs text-sky-300">Open network</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="pb-2 font-medium">Area</th>
                  <th className="pb-2 font-medium">Customers</th>
                  <th className="pb-2 font-medium">Health</th>
                  <th className="pb-2 font-medium">Technician</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.service_areas.map((area) => (
                  <tr key={area.id} className="border-t border-[#1e2a38]">
                    <td className="py-3 text-slate-100">{area.name}</td>
                    <td className="py-3 text-slate-300">{area.customer_count}</td>
                    <td className="py-3">
                      <StatusBadge label={area.health_state} value={area.health_state} />
                    </td>
                    <td className="py-3 text-slate-300">{area.technician_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Latest interpretation" actions={latest ? <Link to={`/incidents/${latest.id}`} className="text-xs text-sky-300">Open evidence</Link> : null}>
          {latest ? (
            <div>
              <p className="font-mono text-sm text-sky-200">{latest.reference}</p>
              <p className="mt-2 text-sm text-slate-100">{latest.explanation}</p>
              <p className="mt-3 text-xs text-slate-500">
                Detected {formatClock(latest.detected_at)}
                {latest.resolved_at ? ` · Resolved ${formatClock(latest.resolved_at)} · ${formatDuration(latest.duration_ms)}` : ` · ${formatDuration(latest.duration_ms)}`}
              </p>
              <p className="mt-2 text-xs text-slate-500">Facts and interpretation are kept separate. A physical root cause is not asserted.</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No incidents recorded yet.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  badge,
  hint,
}: {
  label: string;
  value: string;
  badge?: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[#1e2a38] bg-[#121a24] px-5 py-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {badge ? <StatusBadge label={value} value={badge} /> : <p className="text-lg font-semibold text-white">{value}</p>}
      </div>
      {hint ? <p className="mt-2 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
