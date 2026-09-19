import { useDashboard } from '../context/DashboardContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Topology } from '../components/Topology';
import { ServiceAreaCard } from '../components/ServiceAreaCard';

export function NetworkPage() {
  const { dashboard } = useDashboard();
  if (!dashboard) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Network"
        description="Reachability from simulated edge agents in Mukono A and Mukono B. Primary-path loss is reported over simulated cellular fallback."
      />
      <div className="mb-4">
        <Topology nodes={dashboard.topology.nodes} links={dashboard.topology.links} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {dashboard.service_areas.map((area) => (
          <ServiceAreaCard key={area.id} area={area} />
        ))}
      </div>
    </div>
  );
}
