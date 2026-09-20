import { useEffect, useMemo, useState } from 'react';
import { Phone } from 'lucide-react';
import { listUssdDemoPhones, sendUssd, type UssdDemoPhone } from '../services/api';

const MENUS = {
  CUSTOMER: 'IncidentBridge Customer\n1. Check my service status\n2. Report a problem',
  TECHNICIAN: 'IncidentBridge Technician\n1. Acknowledge incident\n2. My open assignments\n0. Exit',
};

export function UssdPanel() {
  const [phones, setPhones] = useState<UssdDemoPhone[]>([]);
  const [phone, setPhone] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const selected = useMemo(
    () => phones.find((item) => item.phone === phone) || phones[0],
    [phones, phone],
  );
  const [screen, setScreen] = useState(MENUS.CUSTOMER);
  const [busy, setBusy] = useState(false);
  const [refDraft, setRefDraft] = useState('');

  useEffect(() => {
    let cancelled = false;
    listUssdDemoPhones()
      .then((items) => {
        if (cancelled) return;
        setPhones(items);
        setLoadError(null);
        if (items[0]) {
          setPhone(items[0].phone);
          setScreen(MENUS[items[0].role as keyof typeof MENUS] || MENUS.CUSTOMER);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Failed to load phones');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(text: string) {
    if (!phone) return;
    setBusy(true);
    try {
      const response = await sendUssd(phone, text);
      setScreen(response.replace(/^(CON|END)\s/, ''));
    } catch (error) {
      setScreen(error instanceof Error ? error.message : 'USSD failed');
    } finally {
      setBusy(false);
    }
  }

  function switchPhone(next: string) {
    const item = phones.find((entry) => entry.phone === next) || phones[0];
    setPhone(next);
    setScreen(MENUS[(item?.role as keyof typeof MENUS) || 'CUSTOMER'] || MENUS.CUSTOMER);
    setRefDraft('');
  }

  const role = selected?.role || 'CUSTOMER';

  return (
    <section className="flex h-full flex-col rounded-3xl border border-line bg-surface shadow-[0_18px_40px_rgba(9,115,63,0.08)]">
      <div className="flex items-center gap-2 border-b border-line px-5 py-3">
        <Phone className="h-4 w-4 text-muted" />
        <h2 className="text-sm font-semibold tracking-wide text-ink">USSD session</h2>
        <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
          {role}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <label className="mb-2 text-xs uppercase tracking-wide text-muted">Calling as</label>
        {loadError ? <p className="mb-3 text-sm text-[#8f1f1f]">{loadError}</p> : null}
        <select
          value={phone}
          onChange={(event) => switchPhone(event.target.value)}
          disabled={!phones.length}
          className="mb-4 rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm text-ink disabled:opacity-50"
        >
          {phones.length === 0 ? <option value="">Loading from API…</option> : null}
          {phones.map((item) => (
            <option key={item.phone} value={item.phone}>
              {item.label} ({item.phone})
            </option>
          ))}
        </select>
        <p className="mb-3 text-xs text-muted">
          {role === 'TECHNICIAN'
            ? 'Technician menu only — acknowledge by SMS reference. Customer options are blocked.'
            : 'Customer menu only — check status or report a problem. Technician ack is blocked.'}
        </p>
        <pre className="min-h-[180px] flex-1 whitespace-pre-wrap rounded-2xl border border-brand-deep bg-[var(--ib-topo-bg)] p-4 font-mono text-sm leading-6 text-[var(--ib-topo-label)]">
          {screen}
        </pre>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !phone}
            onClick={() => run('')}
            className="rounded-full border border-line px-3 py-2 text-sm text-ink disabled:opacity-50"
          >
            Menu
          </button>
          {role === 'CUSTOMER' ? (
            <>
              <button
                type="button"
                disabled={busy || !phone}
                onClick={() => run('1')}
                className="rounded-full border border-line px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                1. Check status
              </button>
              <button
                type="button"
                disabled={busy || !phone}
                onClick={() => run('2')}
                className="rounded-full border border-line px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                2. Report problem
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || !phone}
                onClick={() => run('1')}
                className="rounded-full border border-line px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                1. Acknowledge
              </button>
              <button
                type="button"
                disabled={busy || !phone}
                onClick={() => run('2')}
                className="rounded-full border border-line px-3 py-2 text-sm text-ink disabled:opacity-50"
              >
                2. My assignments
              </button>
              <div className="flex w-full flex-wrap items-center gap-2">
                <input
                  value={refDraft}
                  onChange={(event) => setRefDraft(event.target.value)}
                  placeholder="IB-1056"
                  className="min-w-[140px] flex-1 rounded-full border border-line bg-surface-2 px-3 py-2 text-sm text-ink"
                />
                <button
                  type="button"
                  disabled={busy || !phone || !refDraft.trim()}
                  onClick={() => run(`1*${refDraft.trim()}`)}
                  className="rounded-full bg-brand px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  Send reference
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
