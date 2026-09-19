import { query } from '../db/pool.js';

export async function logEvent({ type, message, incidentId = null, serviceAreaId = null }) {
  const result = await query(
    `INSERT INTO events (type, message, incident_id, service_area_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, occurred_at, type, message, incident_id, service_area_id`,
    [type, message, incidentId, serviceAreaId],
  );
  const row = result.rows[0];
  console.log(`[event] ${row.type}: ${row.message}`);
  return row;
}

export async function listEvents(limit = 40) {
  const result = await query(
    `SELECT id, occurred_at, type, message, incident_id, service_area_id
     FROM events
     ORDER BY occurred_at DESC, id DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}
