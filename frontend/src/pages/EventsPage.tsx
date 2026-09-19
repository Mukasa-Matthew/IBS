import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { formatClock } from '../lib/format';

export function EventsPage() {
  const { dashboard } = useDashboard();
  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Event log"
        description="Monitoring observations, incident detection, impact, assignment, notifications, and recovery."
      />
      <Panel title="Live stream" subtitle="Newest first">
        {dashboard.events.length === 0 ? (
          <p className="text-sm text-slate-500">Waiting for monitoring observations.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto font-mono text-[12px] leading-6">
            {dashboard.events.map((event) => (
              <div key={event.id} className="grid grid-cols-[88px_110px_1fr] gap-3 border-b border-[#1a2430] py-2">
                <span className="text-slate-500">{formatClock(event.occurred_at)}</span>
                <span className="text-slate-400">{event.type}</span>
                <span className="text-slate-100">{event.message}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
