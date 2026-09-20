import { query } from '../../db/pool.js';
import { FailureDomain } from '../localization/engine.js';
import { getNocTechnician } from '../network/index.js';
import { isValidUgPhone, normalizeUgPhone } from './phone.js';

function presentTechnician(row, assignments = []) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    phone: row.phone,
    team: row.team,
    active: row.active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at,
    assignments: assignments.map((item) => ({
      service_area_id: item.service_area_id,
      service_area_name: item.service_area_name,
      service_area_code: item.service_area_code,
      priority: item.priority,
    })),
  };
}

async function assignmentsFor(technicianIds) {
  if (!technicianIds.length) return new Map();
  const result = await query(
    `SELECT tsa.technician_id, tsa.service_area_id, tsa.priority,
            sa.name AS service_area_name, sa.code AS service_area_code
     FROM technician_service_areas tsa
     JOIN service_areas sa ON sa.id = tsa.service_area_id
     WHERE tsa.technician_id = ANY($1::uuid[])
     ORDER BY sa.name, tsa.priority`,
    [technicianIds],
  );
  const map = new Map();
  for (const row of result.rows) {
    if (!map.has(row.technician_id)) map.set(row.technician_id, []);
    map.get(row.technician_id).push(row);
  }
  return map;
}

export async function listTechnicians({ includeInactive = true } = {}) {
  const result = await query(
    `SELECT id, name, role, phone, team, active, created_at, updated_at
     FROM technicians
     ${includeInactive ? '' : 'WHERE active = true'}
     ORDER BY role DESC, name`,
  );
  const byId = await assignmentsFor(result.rows.map((row) => row.id));
  return result.rows.map((row) => presentTechnician(row, byId.get(row.id) || []));
}

export async function getTechnician(id) {
  const result = await query(
    `SELECT id, name, role, phone, team, active, created_at, updated_at
     FROM technicians WHERE id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const byId = await assignmentsFor([id]);
  return presentTechnician(row, byId.get(id) || []);
}

export async function createTechnician(input) {
  const name = String(input.name || '').trim();
  const role = String(input.role || 'FIELD').trim().toUpperCase();
  const team = String(input.team || '').trim() || null;
  const phone = normalizeUgPhone(input.phone);

  if (!name) throw Object.assign(new Error('Name is required'), { status: 400 });
  if (!['NOC', 'FIELD'].includes(role)) {
    throw Object.assign(new Error('Role must be NOC or FIELD'), { status: 400 });
  }
  if (input.phone && !isValidUgPhone(input.phone)) {
    throw Object.assign(new Error('Phone must be a valid Ugandan mobile number'), { status: 400 });
  }

  const inserted = await query(
    `INSERT INTO technicians (name, role, phone, team, active)
     VALUES ($1, $2, $3, $4, COALESCE($5, true))
     RETURNING id, name, role, phone, team, active, created_at, updated_at`,
    [name, role, phone || null, team, input.active !== false],
  );
  return presentTechnician(inserted.rows[0], []);
}

export async function updateTechnician(id, input) {
  const existing = await getTechnician(id);
  if (!existing) return null;

  const name = input.name !== undefined ? String(input.name).trim() : existing.name;
  const role = input.role !== undefined ? String(input.role).trim().toUpperCase() : existing.role;
  const team = input.team !== undefined ? String(input.team || '').trim() || null : existing.team;
  const active = input.active !== undefined ? Boolean(input.active) : existing.active;
  let phone = existing.phone;
  if (input.phone !== undefined) {
    if (!input.phone) phone = null;
    else if (!isValidUgPhone(input.phone)) {
      throw Object.assign(new Error('Phone must be a valid Ugandan mobile number'), { status: 400 });
    } else phone = normalizeUgPhone(input.phone);
  }

  if (!name) throw Object.assign(new Error('Name is required'), { status: 400 });
  if (!['NOC', 'FIELD'].includes(role)) {
    throw Object.assign(new Error('Role must be NOC or FIELD'), { status: 400 });
  }

  const updated = await query(
    `UPDATE technicians
     SET name = $2, role = $3, phone = $4, team = $5, active = $6, updated_at = now()
     WHERE id = $1
     RETURNING id, name, role, phone, team, active, created_at, updated_at`,
    [id, name, role, phone, team, active],
  );
  const byId = await assignmentsFor([id]);
  return presentTechnician(updated.rows[0], byId.get(id) || []);
}

export async function setTechnicianActive(id, active) {
  const updated = await query(
    `UPDATE technicians SET active = $2, updated_at = now()
     WHERE id = $1
     RETURNING id, name, role, phone, team, active, created_at, updated_at`,
    [id, Boolean(active)],
  );
  if (!updated.rows[0]) return null;
  const byId = await assignmentsFor([id]);
  return presentTechnician(updated.rows[0], byId.get(id) || []);
}

export async function setAreaTechnicianAssignments(areaId, assignments) {
  const area = await query(`SELECT id, name, code FROM service_areas WHERE id = $1`, [areaId]);
  if (!area.rows[0]) {
    throw Object.assign(new Error('Service area not found'), { status: 404 });
  }

  const cleaned = [];
  for (const item of assignments || []) {
    const priority = String(item.priority || '').toUpperCase();
    if (!['PRIMARY', 'BACKUP'].includes(priority)) {
      throw Object.assign(new Error('Priority must be PRIMARY or BACKUP'), { status: 400 });
    }
    const tech = await query(
      `SELECT id, active FROM technicians WHERE id = $1`,
      [item.technician_id],
    );
    if (!tech.rows[0]) {
      throw Object.assign(new Error('Technician not found'), { status: 400 });
    }
    cleaned.push({ technician_id: item.technician_id, priority });
  }

  const primaries = cleaned.filter((item) => item.priority === 'PRIMARY');
  if (primaries.length > 1) {
    throw Object.assign(new Error('Only one PRIMARY technician per area'), { status: 400 });
  }

  await query('BEGIN');
  try {
    await query(`DELETE FROM technician_service_areas WHERE service_area_id = $1`, [areaId]);
    for (const item of cleaned) {
      await query(
        `INSERT INTO technician_service_areas (technician_id, service_area_id, priority)
         VALUES ($1, $2, $3)`,
        [item.technician_id, areaId, item.priority],
      );
    }
    const primaryId = primaries[0]?.technician_id || null;
    await query(`UPDATE service_areas SET technician_id = $2 WHERE id = $1`, [
      areaId,
      primaryId,
    ]);
    await query('COMMIT');
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }

  return listAreaAssignments(areaId);
}

export async function listAreaAssignments(areaId) {
  const result = await query(
    `SELECT tsa.priority, t.id, t.name, t.role, t.phone, t.team, t.active
     FROM technician_service_areas tsa
     JOIN technicians t ON t.id = tsa.technician_id
     WHERE tsa.service_area_id = $1
     ORDER BY CASE tsa.priority WHEN 'PRIMARY' THEN 0 ELSE 1 END, t.name`,
    [areaId],
  );
  return result.rows;
}

export async function listServiceAreasDetailed() {
  const areas = await query(
    `SELECT sa.id, sa.name, sa.code, sa.customer_count, sa.health_state,
            sa.technician_id, sa.site_name, sa.access_device_name
     FROM service_areas sa
     ORDER BY sa.name`,
  );
  const result = [];
  for (const area of areas.rows) {
    const assignments = await listAreaAssignments(area.id);
    result.push({
      ...area,
      site_name: area.site_name || `${area.name} site rack`,
      access_device_name: area.access_device_name || `${area.name} OLT`,
      technicians: assignments,
    });
  }
  return result;
}

export async function technicianNotifications(technicianId, limit = 20) {
  const tech = await getTechnician(technicianId);
  if (!tech) return null;
  const phoneDigits = String(tech.phone || '').replace(/[^\d]/g, '');
  const result = await query(
    `SELECT id, created_at, purpose, to_msisdn, message, status, provider,
            environment, detail, provider_message_id, provider_status,
            provider_status_code, cost, incident_id
     FROM sms_messages
     WHERE purpose = 'technician_alert'
       AND (
         incident_id IN (
           SELECT id FROM incidents WHERE assigned_technician_id = $1
         )
         OR regexp_replace(to_msisdn, '[^0-9]', '', 'g') = $2
       )
     ORDER BY created_at DESC
     LIMIT $3`,
    [technicianId, phoneDigits, limit],
  );
  return { technician: tech, messages: result.rows };
}

export async function findAreaResponder(area) {
  const assignments = await query(
    `SELECT t.id, t.name, t.role, t.phone, t.team, t.active, tsa.priority
     FROM technician_service_areas tsa
     JOIN technicians t ON t.id = tsa.technician_id
     WHERE tsa.service_area_id = $1 AND t.active = true
     ORDER BY CASE tsa.priority WHEN 'PRIMARY' THEN 0 ELSE 1 END, t.name`,
    [area.id],
  );
  if (assignments.rows[0]) return assignments.rows[0];

  if (area.technician_id) {
    const legacy = await query(
      `SELECT id, name, role, phone, team, active
       FROM technicians WHERE id = $1 AND active = true`,
      [area.technician_id],
    );
    if (legacy.rows[0]) return legacy.rows[0];
  }
  return null;
}

export async function assignTechnician(domain, areas) {
  if (
    domain === FailureDomain.UPSTREAM_CONNECTIVITY_FAILURE ||
    domain === FailureDomain.UNDETERMINED ||
    areas.length !== 1
  ) {
    const noc = await getNocTechnician();
    if (noc && noc.active !== false) return noc;
    return noc;
  }

  const responder = await findAreaResponder(areas[0]);
  if (responder) return responder;
  return getNocTechnician();
}
