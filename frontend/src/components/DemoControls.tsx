import { applyScenario } from '../services/api';

const SCENARIOS = [
  { id: 'NORMAL_NETWORK', label: 'Normal network' },
  { id: 'FAIL_MUKONO_A_UPLINK', label: 'Fail Mukono A uplink' },
  { id: 'FAIL_MUKONO_B_UPLINK', label: 'Fail Mukono B uplink' },
  { id: 'FAIL_UPSTREAM_INTERNET', label: 'Fail upstream internet' },
  { id: 'FAIL_MUKONO_A_LOCAL_ACCESS', label: 'Fail Mukono A local access' },
  { id: 'FAIL_MUKONO_B_LOCAL_ACCESS', label: 'Fail Mukono B local access' },
  { id: 'AMBIGUOUS_FAILURE', label: 'Ambiguous failure' },
  { id: 'RESTORE_NETWORK', label: 'Restore network' },
];

interface Props {
  current: string;
}

export function DemoControls({ current }: Props) {
  return (
    <section className="rounded-lg border border-amber-400/20 bg-[#16120c] px-5 py-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            Demo / simulation controls
          </p>
          <p className="text-xs text-slate-400">
            Buttons change simulated network state only. The monitoring engine detects incidents.
          </p>
        </div>
        <p className="text-xs text-slate-400">
          Active scenario: <span className="text-amber-200">{current}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SCENARIOS.map((scenario) => {
          const active = current === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => applyScenario(scenario.id).catch((error) => console.error(error))}
              className={`rounded border px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? 'border-amber-300/40 bg-amber-300/15 text-amber-100'
                  : 'border-[#2a3b4d] bg-[#0b1118] text-slate-200 hover:border-amber-300/30 hover:text-white'
              }`}
            >
              {scenario.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
