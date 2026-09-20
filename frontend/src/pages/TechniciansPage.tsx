import { FormEvent, useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import { Panel } from '../components/layout/Panel';
import { StatusBadge } from '../components/StatusBadge';
import {
  createTechnician,
  listServiceAreas,
  listTechnicians,
  setAreaTechnicians,
  setTechnicianStatus,
  updateTechnician,
} from '../services/api';
import type { Technician } from '../types';

interface AreaRow {
  id: string;
  name: string;
  code: string;
  technicians: Array<{
    id: string;
    name: string;
    phone?: string;
    priority: string;
    active?: boolean;
  }>;
}

export function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [areas, setAreas] = useState<AreaRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    role: 'FIELD',
    team: '',
  });
  const [assignAreaId, setAssignAreaId] = useState('');
  const [primaryId, setPrimaryId] = useState('');
  const [backupId, setBackupId] = useState('');

  async function reload() {
    const [techs, serviceAreas] = await Promise.all([listTechnicians(), listServiceAreas()]);
    setTechnicians(techs);
    setAreas(serviceAreas);
    if (!assignAreaId && serviceAreas[0]) setAssignAreaId(serviceAreas[0].id);
  }

  useEffect(() => {
    reload().catch((err) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createTechnician(form);
      setForm({ name: '', phone: '', role: 'FIELD', team: '' });
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (!assignAreaId || !primaryId) {
      setError('Select an area and a primary technician');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const assignments: Array<{ technician_id: string; priority: 'PRIMARY' | 'BACKUP' }> = [
        { technician_id: primaryId, priority: 'PRIMARY' },
      ];
      if (backupId && backupId !== primaryId) {
        assignments.push({ technician_id: backupId, priority: 'BACKUP' });
      }
      await setAreaTechnicians(assignAreaId, assignments);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="Technicians"
        description="Register field and NOC engineers, assign primary/backup coverage per service area, and keep phone numbers ready for live SMS alerts."
      />

      {error ? (
        <div className="mb-4 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Register technician" subtitle="Phones like 0755032436 normalize to +256755032436">
          <form className="grid gap-3" onSubmit={onCreate}>
            <Field label="Full name">
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="field"
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="0755032436"
                className="field"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))}
                  className="field"
                >
                  <option value="FIELD">FIELD</option>
                  <option value="NOC">NOC</option>
                </select>
              </Field>
              <Field label="Team">
                <input
                  value={form.team}
                  onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))}
                  className="field"
                />
              </Field>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Add technician
            </button>
          </form>
        </Panel>

        <Panel title="Area assignment" subtitle="One primary and optional backup per service area">
          <form className="grid gap-3" onSubmit={onAssign}>
            <Field label="Service area">
              <select
                value={assignAreaId}
                onChange={(e) => setAssignAreaId(e.target.value)}
                className="field"
              >
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Primary technician">
              <select value={primaryId} onChange={(e) => setPrimaryId(e.target.value)} className="field">
                <option value="">Select…</option>
                {technicians
                  .filter((tech) => tech.active !== false)
                  .map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.role})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Backup technician">
              <select value={backupId} onChange={(e) => setBackupId(e.target.value)} className="field">
                <option value="">None</option>
                {technicians
                  .filter((tech) => tech.active !== false && tech.id !== primaryId)
                  .map((tech) => (
                    <option key={tech.id} value={tech.id}>
                      {tech.name} ({tech.role})
                    </option>
                  ))}
              </select>
            </Field>
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save assignment
            </button>
          </form>
        </Panel>
      </div>

      <Panel className="mt-4" title="Technician register" subtitle={`${technicians.length} people`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="pb-2 pr-3 font-medium">Name</th>
                <th className="pb-2 pr-3 font-medium">Role</th>
                <th className="pb-2 pr-3 font-medium">Phone</th>
                <th className="pb-2 pr-3 font-medium">Areas</th>
                <th className="pb-2 pr-3 font-medium">Status</th>
                <th className="pb-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id} className="border-t border-line">
                  <td className="py-3 pr-3">
                    <p className="text-ink">{tech.name}</p>
                    <p className="text-xs text-muted">{tech.team || '—'}</p>
                  </td>
                  <td className="py-3 pr-3">{tech.role}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{tech.phone || '—'}</td>
                  <td className="py-3 pr-3 text-xs text-muted">
                    {(tech.assignments || [])
                      .map((item) => `${item.service_area_name} (${item.priority})`)
                      .join(', ') || 'Unassigned'}
                  </td>
                  <td className="py-3 pr-3">
                    <StatusBadge
                      label={tech.active === false ? 'Inactive' : 'Active'}
                      value={tech.active === false ? 'FAILED' : 'HEALTHY'}
                    />
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs text-brand"
                        onClick={() => {
                          const phone = window.prompt('Phone', tech.phone || '') || '';
                          updateTechnician(tech.id, { phone })
                            .then(reload)
                            .catch((err) => setError(err.message));
                        }}
                      >
                        Edit phone
                      </button>
                      <button
                        type="button"
                        className="text-xs text-muted"
                        onClick={() =>
                          setTechnicianStatus(tech.id, tech.active === false)
                            .then(reload)
                            .catch((err) => setError(err.message))
                        }
                      >
                        {tech.active === false ? 'Activate' : 'Deactivate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-4" title="Coverage by area">
        <div className="grid gap-3 md:grid-cols-2">
          {areas.map((area) => (
            <div key={area.id} className="rounded-2xl border border-line bg-surface-2 p-4">
              <p className="font-medium text-ink">{area.name}</p>
              <ul className="mt-2 space-y-1 text-xs text-muted">
                {(area.technicians || []).map((tech) => (
                  <li key={`${area.id}-${tech.id}-${tech.priority}`}>
                    {tech.priority}: {tech.name} · {tech.phone || 'no phone'}
                  </li>
                ))}
                {(area.technicians || []).length === 0 ? <li>No assignments</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <style>{`
        .field {
          width: 100%;
          border-radius: 1rem;
          border: 1px solid #d5e0d9;
          background: #f7faf8;
          color: #14201a;
          padding: 0.55rem 0.75rem;
          font-size: 0.875rem;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs uppercase tracking-wide text-muted">
      <span className="mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
