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

export interface EventItem {
  id: number;
  occurred_at: string;
  type: string;
  message: string;
  incident_id: string | null;
  service_area_id: string | null;
}

export interface TopologyNode {
  id: string;
  label: string;
  state: TopologyState;
  type?: string;
  service_area?: string;
  customer_count?: number;
  technician?: string;
}

export interface TopologyLink {
  id: string;
  from: string;
  to: string;
  state: TopologyState;
  label?: string;
}

export interface TechnicianAssignment {
  id?: string;
  name?: string;
  role?: string;
  phone?: string;
  team?: string;
  active?: boolean;
  priority: 'PRIMARY' | 'BACKUP';
  service_area_id?: string;
  service_area_name?: string;
  service_area_code?: string;
}

export interface Technician {
  id: string;
  name: string;
  phone?: string;
  role?: string;
  team?: string;
  active?: boolean;
  assignments?: TechnicianAssignment[];
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
  site_name?: string;
  access_device_name?: string;
  technicians?: TechnicianAssignment[];
  threshold?: {
    fail_domain: string | null;
    consecutive_failures: number;
    consecutive_successes: number;
    failure_threshold: number;
    recovery_threshold: number;
  };
}

export interface SmsMessage {
  id: number;
  created_at: string;
  purpose: string | null;
  to_msisdn: string | null;
  message: string | null;
  status: string;
  provider: string | null;
  environment: string | null;
  detail: string | null;
  provider_message_id: string | null;
  incident_id: string | null;
}

export interface Dashboard {
  generated_at: string;
  simulation_mode: boolean;
  network_status: string;
  summary?: {
    active_incidents: number;
    healthy_areas: number;
    degraded_areas: number;
    offline_areas: number;
    potentially_affected_customers: number;
    failure_threshold: number;
    recovery_threshold: number;
    monitor_interval_ms: number;
  };
  africastalking?: {
    configured: boolean;
    connected: boolean;
    environment: string | null;
    mode: string;
    username: string | null;
    alert_phone: string | null;
    balance?: string | null;
    detail?: string | null;
  };
  topology: { nodes: TopologyNode[]; links: TopologyLink[] };
  service_areas: ServiceArea[];
  incidents: Incident[];
  active_incidents: Incident[];
  events: EventItem[];
  recent_sms?: SmsMessage[];
  simulation: {
    scenario: string;
    label: string;
  };
}
