import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Bell,
  LayoutDashboard,
  ListTree,
  Moon,
  Network,
  Phone,
  FlaskConical,
  Sun,
  Users,
  Search,
} from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { useTheme } from '../../context/ThemeContext';
import { StatusBadge } from '../StatusBadge';

const NAV = [
  { to: '/', label: 'Operations', icon: LayoutDashboard, end: true },
  { to: '/network', label: 'Network', icon: Network },
  { to: '/simulation', label: 'Simulation', icon: FlaskConical },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/technicians', label: 'Technicians', icon: Users },
  { to: '/events', label: 'Event log', icon: ListTree },
  { to: '/channels', label: 'Channels', icon: Phone },
];

export function AppLayout() {
  const { dashboard, error, loading } = useDashboard();
  const { theme, toggleTheme } = useTheme();
  const activeCount = dashboard?.active_incidents.length ?? 0;
  const siteCount = dashboard?.service_areas.length ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <aside className="hidden h-screen w-[260px] shrink-0 flex-col bg-sidebar text-sidebar-ink md:flex">
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent shadow-lg shadow-black/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">IncidentBridge</p>
              <p className="text-[11px] text-sidebar-muted">NOC workspace</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs text-sidebar-ink">
            {siteCount > 0 ? `${siteCount}-site fleet` : 'Loading fleet…'}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/15 bg-brand-deep/40 px-3 py-2 text-xs text-sidebar-muted">
            <Search className="h-3.5 w-3.5" />
            <span>Search console</span>
          </label>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-accent text-white shadow-md shadow-black/15'
                      : 'text-sidebar-muted hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                {item.to === '/incidents' && activeCount > 0 ? (
                  <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                    {activeCount}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/15 px-5 py-4">
          <p className="text-[11px] uppercase tracking-[0.14em] text-sidebar-muted">Live messaging</p>
          <p className="mt-1 text-xs text-sidebar-ink">
            AT {(dashboard?.africastalking?.environment || dashboard?.africastalking?.mode || 'mock').toString()}
            {dashboard?.africastalking?.connected ? ' · connected' : ''}
          </p>
          <p className="mt-3 text-[11px] text-sidebar-muted">Detect. Localize. Route. Inform.</p>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-full px-2.5 py-1 text-xs ${
                    isActive ? 'bg-brand text-white' : 'bg-surface-2 text-muted'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="hidden text-sm text-muted md:block">
            Simulated edge telemetry · real Africa&apos;s Talking SMS
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand dark:bg-brand/20 dark:text-ok">
              Simulation mode
            </span>
            {dashboard ? <StatusBadge label={`Network ${dashboard.network_status}`} value={dashboard.network_status} /> : null}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-line bg-surface p-2 text-muted hover:text-ink"
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              className="relative rounded-full border border-line bg-surface p-2 text-muted"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {activeCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-fail" />
              ) : null}
            </button>
            {dashboard ? (
              <span className="font-mono text-xs text-muted">
                {new Date(dashboard.generated_at).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          {loading ? <p className="text-sm text-muted">Loading operations data…</p> : null}
          {error && !dashboard ? (
            <div className="rounded-3xl border border-fail/30 bg-fail/10 p-6">
              <h1 className="text-lg font-semibold">Unable to reach the API</h1>
              <p className="mt-2 text-sm text-fail">{error}</p>
              <p className="mt-2 text-xs text-muted">Start the backend on port 4000 and Postgres on port 5435.</p>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
