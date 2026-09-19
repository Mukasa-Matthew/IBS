import { useState } from 'react';
import { Phone } from 'lucide-react';
import { sendUssd } from '../services/api';

const PHONES = [
  { phone: '256787106109', label: 'Mukono A subscriber' },
  { phone: '256792255955', label: 'Mukono A alt' },
  { phone: '256700000002', label: 'Mukono B subscriber' },
];

export function UssdPanel() {
  const [phone, setPhone] = useState(PHONES[0].phone);
  const [screen, setScreen] = useState('IncidentBridge\n1. Check my service status\n2. Report a problem');
  const [busy, setBusy] = useState(false);

  async function run(text: string) {
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

  return (
    <section className="flex h-full flex-col rounded-xl border border-[#1e2a38] bg-[#121a24]">
      <div className="flex items-center gap-2 border-b border-[#1e2a38] px-5 py-3">
        <Phone className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold tracking-wide">USSD session</h2>
      </div>
      <div className="flex flex-1 flex-col p-5">
      <label className="mb-2 text-xs uppercase tracking-wide text-slate-500">Subscriber</label>
      <select
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
          setScreen('IncidentBridge\n1. Check my service status\n2. Report a problem');
        }}
        className="mb-4 rounded-lg border border-[#2a3b4d] bg-[#0b1118] px-3 py-2 text-sm text-slate-200"
      >
        {PHONES.map((item) => (
          <option key={item.phone} value={item.phone}>
            {item.label} ({item.phone})
          </option>
        ))}
      </select>
      <pre className="min-h-[180px] flex-1 whitespace-pre-wrap rounded-lg border border-[#1e2a38] bg-[#071015] p-4 font-mono text-sm leading-6 text-emerald-200">
        {screen}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => run('')}
          className="rounded-lg border border-[#2a3b4d] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          Menu
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('1')}
          className="rounded-lg border border-[#2a3b4d] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          1. Check status
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => run('2')}
          className="rounded-lg border border-[#2a3b4d] px-3 py-2 text-sm text-slate-200 disabled:opacity-50"
        >
          2. Report problem
        </button>
      </div>
      </div>
    </section>
  );
}
