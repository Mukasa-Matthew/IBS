import { pool } from './pool.js';
import { config } from '../config/index.js';

const AREA_A_COUNT = 67;
const AREA_B_COUNT = 58;

async function insertTechnician(client, { name, role, phone, team }) {
  const result = await client.query(
    `INSERT INTO technicians (name, role, phone, team)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, role, phone, team],
  );
  return result.rows[0];
}

function alertPhoneDigits() {
  return String(config.africastalking.alertPhone || '256787106109').replace(/[^\d]/g, '');
}

function customerPhone(prefix, index) {
  if (index === 1 && prefix === 'A') return alertPhoneDigits();
  if (index === 1 && prefix === 'B') return '256700000002';
  const base = prefix === 'A' ? 256701000000 : 256702000000;
  return String(base + index);
}

async function seedCustomers(client, areaId, prefix, count) {
  const values = [];
  const params = [];
  for (let i = 1; i <= count; i += 1) {
    const offset = params.length;
    values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, 'ACTIVE')`);
    params.push(`CUST-${prefix}-${String(i).padStart(3, '0')}`, areaId, customerPhone(prefix, i));
  }
  await client.query(
    `INSERT INTO customers (reference, service_area_id, phone, service_status)
     VALUES ${values.join(', ')}`,
    params,
  );
}

export async function seedIfEmpty() {
  const existing = await pool.query('SELECT COUNT(*)::int AS count FROM service_areas');
  if (existing.rows[0].count > 0) {
    console.log('[db] seed data already present');
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const alertPhone = alertPhoneDigits();
    const noc = await insertTechnician(client, {
      name: 'David Mugisha',
      role: 'NOC',
      phone: alertPhone,
      team: 'Network Operations',
    });
    const techA = await insertTechnician(client, {
      name: 'James Okello',
      role: 'FIELD',
      phone: alertPhone,
      team: 'Mukono A Field',
    });
    const techB = await insertTechnician(client, {
      name: 'Sarah Nalwoga',
      role: 'FIELD',
      phone: alertPhone,
      team: 'Mukono B Field',
    });

    const areaA = await client.query(
      `INSERT INTO service_areas (name, code, customer_count, technician_id, health_state)
       VALUES ('Mukono A', 'MUKONO_A', $1, $2, 'HEALTHY')
       RETURNING id`,
      [AREA_A_COUNT, techA.id],
    );
    const areaB = await client.query(
      `INSERT INTO service_areas (name, code, customer_count, technician_id, health_state)
       VALUES ('Mukono B', 'MUKONO_B', $1, $2, 'HEALTHY')
       RETURNING id`,
      [AREA_B_COUNT, techB.id],
    );

    await client.query(
      `INSERT INTO monitoring_agents (service_area_id, name, primary_path_status, oob_status)
       VALUES ($1, 'Mukono A Edge Agent', 'AVAILABLE', 'STANDBY'),
              ($2, 'Mukono B Edge Agent', 'AVAILABLE', 'STANDBY')`,
      [areaA.rows[0].id, areaB.rows[0].id],
    );

    await seedCustomers(client, areaA.rows[0].id, 'A', AREA_A_COUNT);
    await seedCustomers(client, areaB.rows[0].id, 'B', AREA_B_COUNT);

    await client.query('COMMIT');
    console.log('[db] seeded technicians, service areas, agents and customers');
    console.log(`[db] NOC engineer id=${noc.id} alert_phone=${alertPhone}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function alignAfricaTalkingRecipients() {
  if (config.africastalking.environment !== 'sandbox') return;

  const phone = alertPhoneDigits();
  if (!phone) return;

  await pool.query('UPDATE technicians SET phone = $1', [phone]);
  await pool.query(
    `UPDATE customers SET phone = $1 WHERE reference = 'CUST-A-001'`,
    [phone],
  );
  console.log(`[db] sandbox SMS/USSD recipients aligned to ${phone}`);
}
