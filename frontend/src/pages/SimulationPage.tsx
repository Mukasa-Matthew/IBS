import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { applyScenario, listSimulationScenarios, type SimulationScenario } from '../services/api';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { AreaTrend, MetricCard } from '../components/LiveCharts';
import { StatusBadge } from '../components/StatusBadge';

export function SimulationPage() {
  const { dashboard, history } = useDashboard();
  const [scenarios, setScenarios] = useState<SimulationScenario[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSimulationScenarios()
      .then(setScenarios)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load scenarios'));
  }, []);

  if (!dashboard) return null;

  const threshold = dashboard.summary?.failure_threshold ?? 3;
  const intervalSec = Math.round((dashboard.summary?.monitor_interval_ms ?? 2000) / 1000);
  const waitSec = threshold * intervalSec;
  const latest = history[history.length - 1];
  const areaSeries = history.map((item) => {
    const scores = Object.values(item.areaScores || {});
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });
  const pressureSeries = history.map((item) =>
    Math.min(100, item.activeIncidents * 25 + Math.min(60, item.affectedCustomers / 2)),
  );
  const upstreamSeries = history.map((item) => item.upstreamScore);
  const fleetLatest = areaSeries[areaSeries.length - 1] ?? latest?.healthScore ?? 0;

  async function run(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      const state = await applyScenario(id);
      setMessage(
        `Scenario applied: ${state.label}. Live graphs will move as probes accumulate. Incidents open after ${threshold} consecutive failures (~${waitSec}s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scenario failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Simulation"
        description="Controls change simulated reachability only. Each site has its own technician — failing a site uplink routes SMS to that tech."
        actions={
          <Link to="/" className="rounded-full border border-line bg-surface px-4 py-2 text-sm text-brand">
            Back to operations
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Fleet health (live)"
          value={String(Math.round(fleetLatest))}
          unit="/100"
          delta={dashboard.simulation.label}
          deltaPositive={fleetLatest > 70}
          tone={fleetLatest > 70 ? 'violet' : 'rose'}
          series={areaSeries}
        />
        <MetricCard
          label="Incident pressure"
          value={String(dashboard.active_incidents.length)}
          delta={`${dashboard.summary?.potentially_affected_customers ?? 0} customers at risk`}
          deltaPositive={dashboard.active_incidents.length === 0}
          tone={dashboard.active_incidents.length === 0 ? 'forest' : 'rose'}
          series={pressureSeries}
        />
        <MetricCard
          label="Upstream score"
          value={String(latest?.upstreamScore ?? 0)}
          unit="/100"
          delta={`Probe every ${intervalSec}s · threshold ${threshold}`}
          deltaPositive={(latest?.upstreamScore ?? 0) > 70}
          tone={(latest?.upstreamScore ?? 0) > 70 ? 'forest' : 'rose'}
          series={upstreamSeries}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <Panel
          className="lg:col-span-3"
          title="Live response to scenario"
          subtitle="Curve drops as failures accumulate — then climbs again on restore"
        >
          <div className="h-52">
            <AreaTrend
              values={areaSeries}
              stroke="#ef8d22"
              fillId="sim-response-fill"
              className="h-full"
            />
          </div>
        </Panel>
        <Panel
          className="lg:col-span-2"
          title="Current scenario"
          subtitle={`Expect ~${waitSec}s to open an incident`}
        >
          <p className="text-sm font-medium text-ink">{dashboard.simulation.label}</p>
          <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto">
            {dashboard.service_areas.map((area) => {
              const t = area.threshold;
              const failing = (t?.consecutive_failures || 0) > 0;
              return (
                <div key={area.id} className="rounded-2xl border border-line bg-surface-2 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-ink">{area.name}</p>
                    <StatusBadge label={area.health_state} value={area.health_state} />
                  </div>
                  <p className="mt-1 text-muted">
                    {area.technician_name} · {area.technician_phone}
                  </p>
                  <p className="mt-1 text-muted">
                    {failing
                      ? `Observation ${t?.consecutive_failures} of ${t?.failure_threshold} before incident${
                          t?.fail_domain ? ` (${t.fail_domain})` : ''
                        }`
                      : t?.consecutive_successes
                        ? `Recovery ${t.consecutive_successes} of ${t.recovery_threshold}`
                        : 'Healthy — no failure streak'}
                  </p>
                </div>
              );
            })}
          </div>
          {message ? <p className="mt-3 text-sm text-brand">{message}</p> : null}
          {error ? <p className="mt-3 text-sm text-[#8f1f1f]">{error}</p> : null}
        </Panel>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {scenarios.map((scenario) => {
          const active = dashboard.simulation.scenario === scenario.id;
          const busy = busyId === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              disabled={Boolean(busyId)}
              onClick={() => run(scenario.id)}
              className={`rounded-3xl border p-4 text-left shadow-[0_12px_30px_rgba(20,32,26,0.04)] transition disabled:opacity-50 ${
                active
                  ? 'border-brand bg-brand-soft'
                  : 'border-line bg-surface hover:border-brand/40'
              }`}
            >
              <p className="text-sm font-semibold text-ink">{scenario.label}</p>
              <p className="mt-2 font-mono text-[11px] text-muted">{scenario.id}</p>
              {busy ? <p className="mt-2 text-[11px] text-brand">Applying…</p> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
