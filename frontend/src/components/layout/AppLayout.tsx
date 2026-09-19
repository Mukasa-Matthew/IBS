import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  LayoutDashboard,
  ListTree,
  Network,
  Phone,
  Radio,
  FlaskConical,
} from 'lucide-react';
import { useDashboard } from '../../context/DashboardContext';
import { StatusBadge } from '../StatusBadge';

const NAV = [
  { to: '/', label: 'Operations', icon: LayoutDashboard, end: true },
  { to: '/network', label: 'Network', icon: Network },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { to: '/events', label: 'Event log', icon: ListTree },
  { to: '/channels', label: 'Customer channels', icon: Phone },
  { to: '/simulation', label: 'Simulation', icon: FlaskConical },
];

export function AppLayout() {
  const { dashboard, error, loading } = useDashboard();

  return (
    <div className="flex min-h-screen bg-[#0b1118] text-slate-100">
      <aside className="hidden w-64 shrink-0 border-r border-[#1e2a38] bg-[#0e1620] md:flex md:flex-col">
        <div className="border-b border-[#1e2a38] px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[#2a3b4d] bg-[#0b1118]">
              <Activity className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">IncidentBridge</p>
              <p className="text-[11px] text-slate-500">NOC console</p>
            </div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                    isActive
                      ? 'bg-sky-400/10 text-sky-100'
                      : 'text-slate-400 hover:bg-[#172333] hover:text-slate-100'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t border-[#1e2a38] px-5 py-4 text-xs text-slate-500">
          Detect. Localize. Route. Inform.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2a38] bg-[#0e1620] px-4 py-3 lg:px-8">
          <div className="flex flex-wrap items-center gap-2 md:hidden">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1 text-xs ${isActive ? 'bg-sky-400/10 text-sky-100' : 'text-slate-400'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-400 md:flex">
            <Radio className="h-3.5 w-3.5" />
            Telemetry and cellular fallback are simulated
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <span className="rounded border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] text-sky-200">
              Simulation
            </span>
            {dashboard ? <StatusBadge label={`Network ${dashboard.network_status}`} value={dashboard.network_status} /> : null}
            {dashboard ? (
              <span className="font-mono text-xs text-slate-500">
                {new Date(dashboard.generated_at).toLocaleTimeString('en-GB', { hour12: false })}
              </span>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-auto px-4 py-6 lg:px-8">
          {loading ? <p className="text-sm text-slate-400">Loading operations data…</p> : null}
          {error && !dashboard ? (
            <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-6">
              <h1 className="text-lg font-semibold">Unable to reach the API</h1>
              <p className="mt-2 text-sm text-rose-200">{error}</p>
              <p className="mt-2 text-xs text-slate-500">Start the backend on port 4000 and Postgres on port 5435.</p>
            </div>
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
