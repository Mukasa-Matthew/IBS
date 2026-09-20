import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchDashboard } from '../services/api';
import type { Dashboard } from '../types';

export interface MetricSample {
  at: string;
  healthScore: number;
  activeIncidents: number;
  affectedCustomers: number;
  upstreamScore: number;
  /** Per service-area code → path score 0–100 */
  areaScores: Record<string, number>;
}

interface DashboardContextValue {
  dashboard: Dashboard | null;
  error: string | null;
  loading: boolean;
  history: MetricSample[];
}

const DashboardContext = createContext<DashboardContextValue | null>(null);
const HISTORY_LIMIT = 18;

function areaScore(dashboard: Dashboard, code: string) {
  const area = dashboard.service_areas.find((item) => item.code === code);
  if (!area) return 50;
  if (area.health_state === 'HEALTHY') return 96;
  if (area.health_state === 'DEGRADED') return 62;
  if (area.health_state === 'FAILURE') return 18;
  return 40;
}

function sampleFromDashboard(dashboard: Dashboard): MetricSample {
  const healthy = dashboard.summary?.healthy_areas ?? 0;
  const total = dashboard.service_areas.length || 1;
  const healthScore = Math.round((healthy / total) * 100);
  const internetLink = dashboard.topology.links.find(
    (link) => link.id.includes('INTERNET') || link.id.includes('UPSTREAM'),
  );
  let upstreamScore = 95;
  if (internetLink?.state === 'FAILURE') upstreamScore = 12;
  else if (internetLink?.state === 'DEGRADED') upstreamScore = 55;
  else if (internetLink?.state === 'UNKNOWN') upstreamScore = 40;

  const areaScores: Record<string, number> = {};
  for (const area of dashboard.service_areas) {
    areaScores[area.code] = areaScore(dashboard, area.code);
  }

  return {
    at: dashboard.generated_at,
    healthScore,
    activeIncidents: dashboard.active_incidents.length,
    affectedCustomers: dashboard.summary?.potentially_affected_customers ?? 0,
    upstreamScore,
    areaScores,
  };
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<MetricSample[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchDashboard();
        if (cancelled) return;
        setDashboard(data);
        setError(null);
        setHistory((prev) => {
          const next = [...prev, sampleFromDashboard(data)];
          return next.slice(-HISTORY_LIMIT);
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to reach API');
      }
    }

    load();
    const timer = window.setInterval(load, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const value = useMemo(
    () => ({ dashboard, error, loading: !dashboard && !error, history }),
    [dashboard, error, history],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
}
