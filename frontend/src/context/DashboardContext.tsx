import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchDashboard } from '../services/api';
import type { Dashboard } from '../types';

interface DashboardContextValue {
  dashboard: Dashboard | null;
  error: string | null;
  loading: boolean;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchDashboard();
        if (!cancelled) {
          setDashboard(data);
          setError(null);
        }
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
    () => ({ dashboard, error, loading: !dashboard && !error }),
    [dashboard, error],
  );

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useDashboard must be used within DashboardProvider');
  return context;
}
