import { UssdPanel } from '../components/UssdPanel';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { SmsStatus } from '../components/SmsStatus';
import { useDashboard } from '../context/DashboardContext';
import { formatClock } from '../lib/format';
import { sendTestSms } from '../services/api';
import { useState } from 'react';

export function ChannelsPage() {
  const { dashboard } = useDashboard();
  const [smsBusy, setSmsBusy] = useState(false);
  const [smsMessage, setSmsMessage] = useState<string | null>(null);
  const [smsError, setSmsError] = useState<string | null>(null);
  const alertPhone = dashboard?.africastalking?.alert_phone || null;

  async function sendSmoke() {
    if (!alertPhone) {
      setSmsError('No alert phone from API (AT_ALERT_PHONE).');
      return;
    }
    setSmsBusy(true);
    setSmsError(null);
    setSmsMessage(null);
    try {
      const result = await sendTestSms(alertPhone, 'IncidentBridge dashboard SMS check.');
      setSmsMessage(`${result.status} → ${result.to}`);
    } catch (error) {
      setSmsError(error instanceof Error ? error.message : 'SMS failed');
    } finally {
      setSmsBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Channels"
        description="Technician SMS via Africa's Talking and customer USSD status. SMS statuses distinguish accepted (SENT) from delivery-confirmed (DELIVERED)."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="SMS"
          subtitle={
            dashboard?.africastalking
              ? `${dashboard.africastalking.environment || dashboard.africastalking.mode} · ${
                  dashboard.africastalking.connected ? 'connected' : 'offline'
                }`
              : 'Provider status unknown'
          }
          actions={
            <button
              type="button"
              disabled={smsBusy || !alertPhone}
              onClick={sendSmoke}
              className="rounded-full bg-brand px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              title={alertPhone ? `To ${alertPhone}` : 'No alert phone from API'}
            >
              Send test SMS
            </button>
          }
        >
          {smsMessage ? <p className="mb-2 text-xs text-brand">{smsMessage}</p> : null}
          {smsError ? <p className="mb-2 text-xs text-[#8f1f1f]">{smsError}</p> : null}
          <div className="space-y-3">
            {(dashboard?.recent_sms || []).slice(0, 8).map((item) => (
              <div key={item.id} className="rounded-2xl border border-line bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-mono text-xs text-muted">{formatClock(item.created_at)}</p>
                  <SmsStatus status={item.status} compact />
                </div>
                <p className="mt-1 text-xs text-muted">{item.to_msisdn}</p>
                <p className="mt-1 line-clamp-2 text-sm text-ink">{item.message}</p>
                <p className="mt-1 text-[11px] text-muted">{item.detail}</p>
              </div>
            ))}
            {(dashboard?.recent_sms || []).length === 0 ? (
              <p className="text-sm text-muted">No SMS messages recorded yet.</p>
            ) : null}
          </div>
        </Panel>
        <div>
          <UssdPanel />
        </div>
      </div>
    </div>
  );
}
