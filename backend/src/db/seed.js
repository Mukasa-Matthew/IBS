import { pool } from './pool.js';
import { config } from '../config/index.js';
import { normalizeUgPhone } from '../modules/technicians/phone.js';

/** Six field sites — one primary technician each. */
export const DEMO_SITES = [
  {
    name: 'Seeta',
    code: 'SITE_SEETA',
    customers: 42,
    site_name: 'Seeta site rack',
    access_device_name: 'Seeta OLT',
    tech: { name: 'Magezi Richard', phone: '0788607860', team: 'Seeta Field', role: 'FIELD' },
  },
  {
    name: 'Nakifuma',
    code: 'SITE_NAKIFUMA',
    customers: 38,
    site_name: 'Nakifuma site rack',
    access_device_name: 'Nakifuma OLT',
    tech: { name: 'Aisu Joshua', phone: '0740724042', team: 'Nakifuma Field', role: 'FIELD' },
  },
  {
    name: 'Katosi',
    code: 'SITE_KATOSI',
    customers: 35,
    site_name: 'Katosi site rack',
    access_device_name: 'Katosi OLT',
    tech: { name: 'Tarsis Mukiibi', phone: '0705660370', team: 'Katosi Field', role: 'FIELD' },
  },
  {
    name: 'Namataba',
    code: 'SITE_NAMATABA',
    customers: 40,
    site_name: 'Namataba site rack',
    access_device_name: 'Namataba OLT',
    tech: { name: 'Elijah', phone: '0787106109', team: 'Namataba Field', role: 'FIELD' },
  },
  {
    name: 'Ggulu',
    code: 'SITE_GGULU',
    customers: 36,
    site_name: 'Ggulu site rack',
    access_device_name: 'Ggulu OLT',
    tech: { name: 'Paul', phone: '0791496003', team: 'Ggulu Field', role: 'FIELD' },
  },
  {
    name: 'Mukono Central',
    code: 'SITE_MUKONO_CENTRAL',
    customers: 55,
    site_name: 'Mukono Central site rack',
    access_device_name: 'Mukono Central OLT',
    tech: { name: 'Matthew', phone: '0755032436', team: 'Mukono Central / NOC', role: 'NOC' },
  },
];

async function insertTechnician(client, { name, role, phone, team }) {
  const result = await client.query(
    `INSERT INTO technicians (name, role, phone, team)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, role, normalizeUgPhone(phone) || phone, team],
  );
  return result.rows[0];
}

function customerPhone(siteIndex, customerIndex) {
  // Unique synthetic MSISDNs per site; first customer on Mukono Central uses live alert phone.
  if (siteIndex === 5 && customerIndex === 1) {
    return String(config.africastalking.alertPhone || '256755032436').replace(/[^\d]/g, '');
  }
  return String(256710000000 + siteIndex * 1000 + customerIndex);
}

async function seedCustomers(client, areaId, siteIndex, count) {
  const values = [];
  const params = [];
  for (let i = 1; i <= count; i += 1) {
    const offset = params.length;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, 'ACTIVE')`);
    params.push(`CUST-${siteIndex + 1}-${String(i).padStart(3, '0')}`, areaId, customerPhone(siteIndex, i));
  }
  await client.query(
    `INSERT INTO customers (reference, service_area_id, phone, service_status)
     VALUES ${values.join(', ')}`,
    params,
  );
}

async function wipeOperationalData(client) {
  await client.query(`
    TRUNCATE TABLE
      sms_delivery_reports,
      sms_messages,
      ussd_notifications,
      customer_reports,
      events,
      observations,
      incident_service_areas,
      incidents,
      customers,
      monitoring_agents,
      technician_service_areas,
      service_areas,
      technicians
    RESTART IDENTITY CASCADE
  `);
}

async function seedFleet(client) {
  for (let i = 0; i < DEMO_SITES.length; i += 1) {
    const site = DEMO_SITES[i];
    const tech = await insertTechnician(client, site.tech);
    const area = await client.query(
      `INSERT INTO service_areas (
          name, code, customer_count, technician_id, health_state, site_name, access_device_name
       ) VALUES ($1, $2, $3, $4, 'HEALTHY', $5, $6)
       RETURNING id`,
      [site.name, site.code, site.customers, tech.id, site.site_name, site.access_device_name],
    );
    const areaId = area.rows[0].id;
    await client.query(
      `INSERT INTO technician_service_areas (technician_id, service_area_id, priority)
       VALUES ($1, $2, 'PRIMARY')`,
      [tech.id, areaId],
    );
    await client.query(
      `INSERT INTO monitoring_agents (service_area_id, name, primary_path_status, oob_status)
       VALUES ($1, $2, 'AVAILABLE', 'STANDBY')`,
      [areaId, `${site.name} Edge Agent`],
    );
    await seedCustomers(client, areaId, i, site.customers);
  }
}

export async function seedIfEmpty() {
  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM service_areas');
  const codes = await pool.query(`SELECT code FROM service_areas`);
  const codeSet = new Set(codes.rows.map((row) => row.code));
  const hasNewFleet = DEMO_SITES.every((site) => codeSet.has(site.code));

  if (existing.rows[0].count > 0 && hasNewFleet) {
    console.log('[db] seed data already present (6-site fleet)');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (existing.rows[0].count > 0) {
      console.log('[db] upgrading seed to 6-site technician fleet');
      await wipeOperationalData(client);
    }
    await seedFleet(client);
    await client.query('COMMIT');
    console.log('[db] seeded 6 sites + technicians (one primary each)');
    for (const site of DEMO_SITES) {
      console.log(`[db]   ${site.code} → ${site.tech.name} ${normalizeUgPhone(site.tech.phone)}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/** Keep USSD/demo customer aligned; do not overwrite field technician phones. */
export async function alignAfricaTalkingRecipients() {
  const phone = String(config.africastalking.alertPhone || '').replace(/[^\d]/g, '');
  if (!phone) return;

  await pool.query(
    `UPDATE customers SET phone = $1
     WHERE reference = 'CUST-6-001'`,
    [phone],
  );
  await pool.query(
    `UPDATE technicians SET phone = $1
     WHERE role = 'NOC' AND name = 'Matthew'`,
    [normalizeUgPhone(phone) || `+${phone}`],
  );
  const label = config.africastalking.environment || 'configured';
  console.log(`[db] ${label} demo customer aligned to ${phone}; field tech phones preserved`);
}
