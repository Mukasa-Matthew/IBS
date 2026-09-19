import { UssdPanel } from '../components/UssdPanel';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';

export function ChannelsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Customer channels"
        description="Out-of-band service status for customers who cannot rely on internet access. The handset UI below calls the same Africa's Talking USSD callback as production."
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <UssdPanel />
        </div>
        <Panel className="lg:col-span-2" title="Africa's Talking endpoints">
          <dl className="grid gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Session callback</dt>
              <dd className="mt-1 font-mono text-slate-200">POST /ussd</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Event notification</dt>
              <dd className="mt-1 font-mono text-slate-200">POST /ussd/events</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500">Demo subscribers</dt>
              <dd className="mt-1 text-slate-300">256787106109 Mukono A</dd>
              <dd className="text-slate-300">256792255955 Mukono A alt</dd>
              <dd className="text-slate-300">256700000002 Mukono B</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}
