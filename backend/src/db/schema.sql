CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS technicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  phone TEXT,
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  customer_count INTEGER NOT NULL DEFAULT 0,
  technician_id UUID REFERENCES technicians(id),
  health_state TEXT NOT NULL DEFAULT 'HEALTHY',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  service_area_id UUID NOT NULL REFERENCES service_areas(id),
  phone TEXT,
  service_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitoring_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_area_id UUID NOT NULL UNIQUE REFERENCES service_areas(id),
  name TEXT NOT NULL,
  primary_path_status TEXT NOT NULL DEFAULT 'AVAILABLE',
  oob_status TEXT NOT NULL DEFAULT 'STANDBY',
  last_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS observations (
  id BIGSERIAL PRIMARY KEY,
  service_area_id UUID NOT NULL REFERENCES service_areas(id),
  local_access_reachable BOOLEAN NOT NULL,
  core_reachable BOOLEAN NOT NULL,
  internet_reachable BOOLEAN NOT NULL,
  failure_domain TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_observations_area_time
  ON observations (service_area_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  failure_domain TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  potentially_affected_customer_count INTEGER NOT NULL DEFAULT 0,
  assigned_technician_id UUID REFERENCES technicians(id),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  explanation TEXT NOT NULL,
  notification_status TEXT NOT NULL DEFAULT 'PENDING',
  notification_detail TEXT
);

CREATE TABLE IF NOT EXISTS incident_service_areas (
  incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  service_area_id UUID NOT NULL REFERENCES service_areas(id),
  PRIMARY KEY (incident_id, service_area_id)
);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  incident_id UUID REFERENCES incidents(id),
  service_area_id UUID REFERENCES service_areas(id)
);

CREATE INDEX IF NOT EXISTS idx_events_time ON events (occurred_at DESC);

CREATE TABLE IF NOT EXISTS customer_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE,
  customer_id UUID REFERENCES customers(id),
  phone TEXT,
  service_area_id UUID REFERENCES service_areas(id),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sequences (
  name TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT INTO sequences (name, value) VALUES ('incident', 1041), ('report', 1000)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS ussd_notifications (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurred_at TEXT,
  session_id TEXT,
  service_code TEXT,
  network_code TEXT,
  phone_number TEXT,
  status TEXT,
  cost TEXT,
  duration_ms TEXT,
  hops_count INTEGER,
  hops_metadata TEXT,
  input TEXT,
  last_app_response TEXT,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS sms_messages (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  purpose TEXT,
  to_msisdn TEXT,
  message TEXT,
  status TEXT NOT NULL,
  provider TEXT,
  environment TEXT,
  detail TEXT,
  provider_message_id TEXT,
  provider_status TEXT,
  provider_status_code TEXT,
  cost TEXT,
  incident_id UUID REFERENCES incidents(id)
);

CREATE TABLE IF NOT EXISTS sms_delivery_reports (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  identifier TEXT,
  phone_number TEXT,
  retry_count TEXT,
  network_code TEXT,
  status TEXT,
  failure_reason TEXT
);
