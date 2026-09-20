import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Globe2, Users } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { Topology } from '../components/Topology';
import { StatusBadge } from '../components/StatusBadge';
import { SmsStatus } from '../components/SmsStatus';
import { AreaTrend, MetricCard } from '../components/LiveCharts';
import { CustomerStatusCard } from '../components/CustomerStatusCard';
import { formatClock, formatDuration } from '../lib/format';

export function OverviewPage() {
  const { dashboard, history } = useDashboard();
  if (!dashboard) return null;

  const summary = dashboard.summary;
  const affectedCustomers =
    summary?.potentially_affected_customers ??
    dashboard.active_incidents.reduce(
      (sum, incident) => sum + incident.potentially_affected_customer_count,
      0,
    );
  const latest = history[history.length - 1];
  const previous = history[history.length - 2];
  const healthSeries = history.map((item) => item.healthScore);
  const incidentSeries = history.map((item) => item.activeIncidents * 20);
  const customerSeries = history.map((item) => Math.min(100, item.affectedCustomers));
  const upstreamSeries = history.map((item) => item.upstreamScore);
  const pathIndexSeries = history.map((item) => {
    const scores = Object.values(item.areaScores || {});
    const areaAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : item.healthScore;
    return Math.round((areaAvg + item.upstreamScore) / 2);
  });
  const highlightIndex = pathIndexSeries.length
    ? pathIndexSeries.reduce((best, value, index, arr) => (value <= arr[best] ? index : best), 0)
    : undefined;
  const healthDelta =
    latest && previous ? latest.healthScore - previous.healthScore : 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Operations"
        description="Live readings respond as simulations change probe outcomes. Incidents still open only after the consecutive-failure threshold."
        actions={
          <Link
            to="/simulation"
            className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white shadow-lg shadow-brand/25"
          >
            Open simulation
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Network health index"
          value={String(latest?.healthScore ?? 0)}
          unit="/100"
          delta={`${healthDelta >= 0 ? '+' : ''}${healthDelta} vs last probe`}
          deltaPositive={healthDelta >= 0}
          tone={healthDelta >= 0 ? 'violet' : 'rose'}
          icon={<Activity className="h-4 w-4" />}
          series={healthSeries}
        />
        <MetricCard
          label="Active incidents"
          value={String(dashboard.active_incidents.length)}
          delta={dashboard.simulation.label}
          deltaPositive={dashboard.active_incidents.length === 0}
          tone={dashboard.active_incidents.length === 0 ? 'forest' : 'rose'}
          icon={<AlertTriangle className="h-4 w-4" />}
          series={incidentSeries}
        />
        <MetricCard
          label="Customers at risk"
          value={String(affectedCustomers)}
          delta={`${summary?.healthy_areas ?? 0} healthy · ${summary?.offline_areas ?? 0} offline`}
          deltaPositive={affectedCustomers === 0}
          tone={affectedCustomers === 0 ? 'violet' : 'rose'}
          icon={<Users className="h-4 w-4" />}
          series={customerSeries}
        />
        <MetricCard
          label="Upstream path"
          value={String(latest?.upstreamScore ?? 0)}
          unit="/100"
          delta={
            dashboard.africastalking?.connected
              ? `AT ${dashboard.africastalking.environment} connected`
              : 'AT offline'
          }
          deltaPositive={Boolean(dashboard.africastalking?.connected) && (latest?.upstreamScore ?? 0) > 70}
          tone={(latest?.upstreamScore ?? 0) > 70 ? 'forest' : 'rose'}
          icon={<Globe2 className="h-4 w-4" />}
          series={upstreamSeries}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Path integrity index"
          subtitle="Composite of all site path scores and upstream over recent probes"
        >
          <div className="-mx-1 h-48">
            <AreaTrend
              values={pathIndexSeries}
              stroke="#ef8d22"
              fillId="path-integrity-fill"
              fillFrom="rgba(239,141,34,0.28)"
              fillTo="rgba(239,141,34,0.02)"
              className="h-full"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
            {dashboard.service_areas.map((area) => (
              <span key={area.id}>
                {area.name} {latest?.areaScores?.[area.code] ?? '—'}
              </span>
            ))}
            <span>Upstream {latest?.upstreamScore ?? '—'}</span>
            {highlightIndex != null && pathIndexSeries[highlightIndex] != null ? (
              <span className="text-accent">Lowest point {pathIndexSeries[highlightIndex]} at t{highlightIndex + 1}</span>
            ) : null}
          </div>
        </Panel>
        <Panel
          className="lg:col-span-2"
          dark
          title="Impact pressure"
          subtitle="Customers potentially affected as failures accumulate"
        >
          <p className="text-4xl font-semibold text-white">{affectedCustomers}</p>
          <p className="mt-1 text-sm text-muted">potentially affected customers</p>
          <div className="mt-6 space-y-3">
            {dashboard.service_areas.map((area) => (
              <div key={area.id} className="flex items-center justify-between rounded-2xl bg-surface/5 px-3 py-2">
                <div>
                  <p className="text-sm text-white">{area.name}</p>
                  <p className="text-[11px] text-muted">
                    fail streak {area.threshold?.consecutive_failures ?? 0}/
                    {area.threshold?.failure_threshold ?? 3}
                  </p>
                </div>
                <StatusBadge label={area.health_state} value={area.health_state} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <DemoStep to="/simulation" step="1" title="Simulate a failure" body="Change reachability only — buttons never create incidents directly." />
        <DemoStep to="/network" step="2" title="Watch topology + graphs" body="Links and live readings move as probes accumulate toward the threshold." />
        <DemoStep to="/incidents" step="3" title="Inspect routing + SMS" body="Failure domain, technician assignment, and Africa's Talking status." />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(20,32,26,0.08)] lg:col-span-3">
          <Topology large nodes={dashboard.topology.nodes} links={dashboard.topology.links} />
        </div>
        <div className="flex flex-col gap-4 lg:col-span-2">
          <CustomerStatusCard areas={dashboard.service_areas} />
          <Panel
            title="Active incidents"
            subtitle={`${dashboard.active_incidents.length} open`}
            actions={
              <Link to="/incidents" className="text-xs font-medium text-brand">
                View all
              </Link>
            }
          >
            {dashboard.active_incidents.length === 0 ? (
              <p className="text-sm text-muted">No active incidents. All customers should show active.</p>
            ) : (
              <div className="grid gap-3">
                {dashboard.active_incidents.slice(0, 3).map((incident) => (
                  <Link
                    key={incident.id}
                    to={`/incidents/${incident.id}`}
                    className="rounded-2xl border border-line bg-surface-2 p-3 hover:border-brand/40"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-sm text-brand">{incident.reference}</p>
                      <StatusBadge label={incident.severity} value={incident.severity} />
                    </div>
                    <p className="mt-2 text-sm text-ink">{incident.title}</p>
                    <p className="mt-2 text-xs text-muted">
                      {incident.area_names.join(', ')} · {incident.impact_statement}
                    </p>
                    <div className="mt-2">
                      <SmsStatus status={incident.notification_status} compact />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Service areas" actions={<Link to="/network" className="text-xs font-medium text-brand">Open network</Link>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="pb-2 pr-4 font-medium">Area</th>
                  <th className="pb-2 pr-4 font-medium">Health</th>
                  <th className="pb-2 pr-4 font-medium">Technician</th>
                  <th className="pb-2 font-medium">Live score</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.service_areas.map((area) => {
                  const score = latest?.areaScores?.[area.code];
                  return (
                    <tr key={area.id} className="border-t border-line">
                      <td className="py-3 pr-4">
                        <p className="font-medium">{area.name}</p>
                        <p className="text-xs text-muted">{area.customer_count} customers</p>
                      </td>
                      <td className="py-3 pr-4">
                        <StatusBadge label={area.health_state} value={area.health_state} />
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted">
                        {area.technician_name || 'Unassigned'}
                        <br />
                        <span className="font-mono">{area.technician_phone}</span>
                      </td>
                      <td className="py-3 font-mono text-sm text-brand">{score ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Latest activity" actions={<Link to="/events" className="text-xs font-medium text-brand">Event log</Link>}>
          <div className="space-y-3">
            {dashboard.events.slice(0, 8).map((event) => (
              <div key={event.id} className="border-l-2 border-[#b7d8c4] pl-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">
                  {event.type} · {formatClock(event.occurred_at)}
                </p>
                <p className="text-sm text-ink">{event.message}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {dashboard.active_incidents[0] ? (
        <p className="mt-4 text-xs text-muted">
          Leading incident open for {formatDuration(dashboard.active_incidents[0].duration_ms)}.
        </p>
      ) : null}
    </div>
  );
}

function DemoStep({
  to,
  step,
  title,
  body,
}: {
  to: string;
  step: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-3xl border border-line bg-surface p-4 shadow-[0_12px_30px_rgba(20,32,26,0.04)] hover:border-brand/35"
    >
      <p className="text-[11px] uppercase tracking-[0.16em] text-brand">Step {step}</p>
      <p className="mt-1 text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted">{body}</p>
    </Link>
  );
}
