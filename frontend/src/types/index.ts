export type HealthState = 'HEALTHY' | 'DEGRADED' | 'FAILURE' | 'UNKNOWN';

export type TopologyState = 'HEALTHY' | 'DEGRADED' | 'FAILURE' | 'UNKNOWN';

export interface Observation {
  service_area_id: string;
  local_access_reachable: boolean;
  core_reachable: boolean;
  internet_reachable: boolean;
  failure_domain: string;
  observed_at: string;
}

export interface EvidenceFact {
  key: string;
  ok: boolean;
  text: string;
}

export interface Evidence {
  domain?: string;
  facts?: EvidenceFact[];
  inference?: string;
  explanation?: string;
  consecutiveCount?: number;
}

export interface Technician {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  team?: string;
}

export interface AreaSummary {
  id: string;
  name: string;
  code: string;
  customer_count: number;
}

export interface Incident {
  id: string;
  reference: string;
  title: string;
  failure_domain: string;
  failure_domain_label: string;
  severity: string;
  status: string;
  detected_at: string;
  resolved_at: string | null;
  potentially_affected_customer_count: number;
  impact_statement: string;
  explanation: string;
  evidence: Evidence;
  notification_status: string;
  notification_detail?: string | null;
  duration_ms: number | null;
  areas: AreaSummary[];
  area_names: string[];
  assigned_technician: Technician | null;
}

export interface ServiceArea {
  id: string;
  name: string;
  code: string;
  customer_count: number;
  health_state: HealthState;
  technician_name: string;
  technician_phone: string;
  technician_role: string;
  agent_name: string;
  primary_path_status: string;
  oob_status: string;
  primary_path_label: string;
  oob_label: string;
  last_seen_at: string | null;
  observation: Observation | null;
}

export interface TopologyNode {
  id: string;
  label: string;
  state: TopologyState;
}

export interface TopologyLink {
  id: string;
  from: string;
  to: string;
  state: TopologyState;
}

export interface EventItem {
  id: number;
  occurred_at: string;
  type: string;
  message: string;
  incident_id: string | null;
  service_area_id: string | null;
}

export interface Dashboard {
  generated_at: string;
  simulation_mode: boolean;
  network_status: string;
  topology: { nodes: TopologyNode[]; links: TopologyLink[] };
  service_areas: ServiceArea[];
  incidents: Incident[];
  active_incidents: Incident[];
  events: EventItem[];
  simulation: {
    scenario: string;
    label: string;
  };
}
