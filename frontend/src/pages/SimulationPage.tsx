import { applyScenario } from '../services/api';
import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';

const SCENARIOS = [
  {
    id: 'NORMAL_NETWORK',
    label: 'Normal network',
    description: 'All probes succeed. Use this as the baseline, or Restore after a failure.',
  },
  {
    id: 'FAIL_MUKONO_A_UPLINK',
    label: 'Fail Mukono A uplink',
    description: 'Mukono A local access stays up. Core and internet through that area fail.',
  },
  {
    id: 'FAIL_MUKONO_B_UPLINK',
    label: 'Fail Mukono B uplink',
    description: 'Same pattern as Mukono A, isolated to Mukono B.',
  },
  {
    id: 'FAIL_UPSTREAM_INTERNET',
    label: 'Fail upstream internet',
    description: 'Both areas reach core but not internet. Should correlate into one shared incident.',
  },
  {
    id: 'FAIL_MUKONO_A_LOCAL_ACCESS',
    label: 'Fail Mukono A local access',
    description: 'Local access down while core and internet probes still succeed.',
  },
  {
    id: 'FAIL_MUKONO_B_LOCAL_ACCESS',
    label: 'Fail Mukono B local access',
    description: 'Local access failure isolated to Mukono B.',
  },
  {
    id: 'AMBIGUOUS_FAILURE',
    label: 'Ambiguous failure',
    description: 'Contradictory probes. Localization must remain UNDETERMINED.',
  },
  {
    id: 'RESTORE_NETWORK',
    label: 'Restore network',
    description: 'Return all probes to healthy. Incidents resolve after the recovery threshold.',
  },
];

export function SimulationPage() {
  const { dashboard } = useDashboard();
  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Simulation"
        description="These controls change simulated network state only. They do not create incidents. The monitoring and localization engine detects the resulting condition after consecutive probes."
      />
      <Panel
        title="Current scenario"
        subtitle="Wait about six seconds after applying a failure (three probes at two-second intervals)."
      >
        <p className="text-sm text-slate-200">{dashboard.simulation.label}</p>
      </Panel>
      <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((scenario) => {
          const active = dashboard.simulation.scenario === scenario.id;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => applyScenario(scenario.id).catch((error) => console.error(error))}
              className={`rounded-xl border p-4 text-left transition ${
                active
                  ? 'border-amber-300/40 bg-amber-300/10'
                  : 'border-[#1e2a38] bg-[#121a24] hover:border-[#33465c]'
              }`}
            >
              <p className="text-sm font-semibold text-slate-100">{scenario.label}</p>
              <p className="mt-2 text-xs leading-5 text-slate-400">{scenario.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
