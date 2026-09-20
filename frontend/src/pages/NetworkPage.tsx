import { useMemo, useState } from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { Topology } from '../components/Topology';
import { ServiceAreaCard } from '../components/ServiceAreaCard';
import { StatusBadge } from '../components/StatusBadge';
import { MetricCard } from '../components/LiveCharts';
import { CustomerStatusCard } from '../components/CustomerStatusCard';
import { formatClock } from '../lib/format';
import type { ServiceArea, TopologyLink, TopologyNode } from '../types';

export function NetworkPage() {
  const { dashboard, history } = useDashboard();
  const [selection, setSelection] = useState<{
    kind: 'node' | 'link';
    item: TopologyNode | TopologyLink;
  } | null>(null);

  const relatedArea: ServiceArea | null = useMemo(() => {
    if (!dashboard || !selection || selection.kind !== 'node') return null;
    const node = selection.item as TopologyNode;
    if (!node.service_area) return null;
    return dashboard.service_areas.find((area) => area.name === node.service_area) || null;
  }, [dashboard, selection]);

  if (!dashboard) return null;

  const fleetSeries = history.map((item) => {
    const scores = Object.values(item.areaScores || {});
    if (!scores.length) return item.healthScore;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });
  const upstream = history.map((item) => item.upstreamScore);
  const latest = history[history.length - 1];
  const offlineCount = dashboard.service_areas.filter((a) => a.health_state === 'FAILURE').length;
  const healthyCount = dashboard.service_areas.filter((a) => a.health_state === 'HEALTHY').length;
  const siteCount = dashboard.service_areas.length;
  const fleetLatest = fleetSeries[fleetSeries.length - 1] ?? latest?.healthScore ?? 0;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Network"
        description={`Internet → upstream → core → ${siteCount} site racks (each with its own technician) → OLT → customers. Click a node for details.`}
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Fleet path health"
          value={String(fleetLatest)}
          unit="/100"
          deltaPositive={fleetLatest > 70}
          delta={`${healthyCount} healthy · ${offlineCount} offline`}
          tone={fleetLatest > 70 ? 'violet' : 'rose'}
          series={fleetSeries}
        />
        <MetricCard
          label="Sites online"
          value={`${healthyCount}/${siteCount}`}
          deltaPositive={offlineCount === 0}
          delta={offlineCount === 0 ? 'All sites reachable' : `${offlineCount} site(s) in failure`}
          tone={offlineCount === 0 ? 'forest' : 'rose'}
          series={history.map((item) =>
            Math.round(
              (Object.values(item.areaScores || {}).filter((s) => s > 70).length /
                Math.max(1, Object.keys(item.areaScores || {}).length)) *
                100,
            ),
          )}
        />
        <MetricCard
          label="Upstream / internet"
          value={String(latest?.upstreamScore ?? 0)}
          unit="/100"
          deltaPositive={(latest?.upstreamScore ?? 0) > 70}
          delta={(latest?.upstreamScore ?? 0) > 70 ? 'Transit healthy' : 'Transit pressure'}
          tone={(latest?.upstreamScore ?? 0) > 70 ? 'violet' : 'rose'}
          series={upstream}
        />
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-5">
        <div className="overflow-hidden rounded-3xl shadow-[0_18px_40px_rgba(20,32,26,0.08)] lg:col-span-3">
          <Topology
            large
            nodes={dashboard.topology.nodes}
            links={dashboard.topology.links}
            onSelect={setSelection}
          />
        </div>
        <div className="grid gap-4 lg:col-span-2">
          <CustomerStatusCard areas={dashboard.service_areas} />
          <Panel title="Selection details" subtitle={selection ? selection.kind.toUpperCase() : 'Click the canvas'}>
            {!selection ? (
              <p className="text-sm text-muted">
                Select Internet, upstream, core, a site rack, OLT, customer group, or any labelled link.
              </p>
            ) : selection.kind === 'node' ? (
              <NodeDetails node={selection.item as TopologyNode} area={relatedArea} />
            ) : (
              <LinkDetails link={selection.item as TopologyLink} />
            )}
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboard.service_areas.map((area) => (
          <ServiceAreaCard
            key={area.id}
            area={area}
            scoreSeries={history.map((item) => item.areaScores?.[area.code] ?? latest?.healthScore ?? 0)}
          />
        ))}
      </div>
    </div>
  );
}

function NodeDetails({ node, area }: { node: TopologyNode; area: ServiceArea | null }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-ink">{node.label}</p>
        <StatusBadge label={node.state} value={node.state} />
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs text-muted">
        <div>
          <dt className="uppercase tracking-wide">Type</dt>
          <dd className="text-ink">{node.type || 'node'}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide">Service area</dt>
          <dd className="text-ink">{node.service_area || 'Shared / core'}</dd>
        </div>
        {node.technician ? (
          <div className="col-span-2">
            <dt className="uppercase tracking-wide">Technician</dt>
            <dd className="text-ink">{node.technician}</dd>
          </div>
        ) : null}
        {node.customer_count != null ? (
          <div>
            <dt className="uppercase tracking-wide">Customers</dt>
            <dd className="text-ink">{node.customer_count}</dd>
          </div>
        ) : null}
      </dl>
      {area ? (
        <div className="rounded-2xl border border-line bg-surface-2 p-3 text-xs text-muted">
          <p>Primary path: {area.primary_path_label}</p>
          <p className="mt-1">OOB: {area.oob_label}</p>
          <p className="mt-1">
            Technician: {area.technician_name || 'Unassigned'} ({area.technician_phone || '—'})
          </p>
          <p className="mt-1">
            Last observation:{' '}
            {area.observation ? formatClock(area.observation.observed_at) : '—'}
          </p>
          {area.observation ? (
            <p className="mt-2">
              local={String(area.observation.local_access_reachable)} · core=
              {String(area.observation.core_reachable)} · internet=
              {String(area.observation.internet_reachable)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function LinkDetails({ link }: { link: TopologyLink }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-ink">{link.label || link.id}</p>
        <StatusBadge label={link.state} value={link.state} />
      </div>
      <p className="text-xs text-muted">
        {link.from} → {link.to}
      </p>
      <p className="text-xs leading-5 text-muted">
        Link state is derived from simulated edge observations after consecutive probe thresholds —
        not from clicking simulation buttons alone.
      </p>
    </div>
  );
}
