import { FailureDomain } from '../localization/engine.js';
import { getNocTechnician } from '../network/index.js';

export async function assignTechnician(domain, areas) {
  if (
    domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE ||
    domain === FailureDomain.UNDETERMINED
  ) {
    return getNocTechnician();
  }

  if (areas.length === 1 && areas[0].technician_id) {
    return {
      id: areas[0].technician_id,
      name: areas[0].technician_name,
      role: areas[0].technician_role,
      phone: areas[0].technician_phone,
      team: areas[0].technician_team,
    };
  }

  return getNocTechnician();
}
