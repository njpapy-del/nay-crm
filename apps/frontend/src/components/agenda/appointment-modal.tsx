'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Star } from 'lucide-react';
import { api } from '@/lib/api';
import type { CriteriaField, Criteria } from '@/components/campaign-criteria/criteria-builder';

// ─── Types ───────────────────────────────────────────────────────────────────

const STATUSES = ['SCHEDULED', 'CONFIRMED', 'CANCELLED', 'DONE'];
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Planifié', CONFIRMED: 'Confirmé', CANCELLED: 'Annulé', DONE: 'Terminé',
};

interface Agent    { id: string; firstName: string; lastName: string; }
interface Campaign { id: string; name: string; }
interface Client   { id: string; firstName: string; lastName: string; }

interface FormData {
  agentId: string; title: string; description: string;
  startAt: string; endAt: string; status: string;
  campaignId: string; clientId: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  initial?: Partial<FormData> & { id?: string };
}

// ─── Dynamic field renderer ───────────────────────────────────────────────────

function DynamicField({
  field, value, onChange,
}: { field: CriteriaField; value: string; onChange: (v: string) => void }) {
  const opts = (field.options ?? []) as Array<{ label: string; value: string }>;

  if (field.type === 'BOOLEAN') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm">
        <option value="">— choisir —</option>
        <option value="true">Oui</option>
        <option value="false">Non</option>
      </select>
    );
  }

  if (field.type === 'SELECT') {
    return (
      <select value={value} onChange={e => onChange(e.target.value)} className="input-field text-sm">
        <option value="">— choisir —</option>
        {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }

  if (field.type === 'MULTI_SELECT') {
    const selected: string[] = value ? JSON.parse(value) : [];
    const toggle = (v: string) => {
      const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v];
      onChange(JSON.stringify(next));
    };
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map(o => (
          <button key={o.value} type="button"
            onClick={() => toggle(o.value)}
            className={`px-2 py-1 rounded-full text-xs border transition-colors ${
              selected.includes(o.value)
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === 'NUMBER') {
    return (
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className="input-field text-sm"
        min={(field.validation as any)?.min}
        max={(field.validation as any)?.max} />
    );
  }

  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      className="input-field text-sm" />
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function AppointmentModal({ open, onClose, onSaved, initial }: Props) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<FormData>({
    agentId: '', title: '', description: '', startAt: '', endAt: '',
    status: 'SCHEDULED', campaignId: '', clientId: '', ...initial,
  });
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [criteria,  setCriteria]  = useState<Criteria | null>(null);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [saving,    setSaving]    = useState(false);

  // Chargement des listes
  useEffect(() => {
    if (!open) return;
    Promise.allSettled([
      api.get('/users?role=AGENT&limit=100'),
      api.get('/campaigns?status=ACTIVE&limit=100'),
      api.get('/clients?limit=100'),
    ]).then(([a, c, cl]) => {
      if (a.status  === 'fulfilled') setAgents(a.value.data?.data    ?? a.value.data    ?? []);
      if (c.status  === 'fulfilled') setCampaigns(c.value.data?.data ?? c.value.data    ?? []);
      if (cl.status === 'fulfilled') setClients(cl.value.data?.data  ?? cl.value.data   ?? []);
    });
  }, [open]);

  // Reset form quand initial change
  useEffect(() => {
    setForm({ agentId: '', title: '', description: '', startAt: '', endAt: '', status: 'SCHEDULED', campaignId: '', clientId: '', ...initial });
    setResponses({});
    setCriteria(null);
  }, [initial]);

  // Chargement critères quand la campagne change
  useEffect(() => {
    if (!form.campaignId) { setCriteria(null); return; }
    api.get(`/campaigns/${form.campaignId}/criteria`)
      .then(r => { const data = r.data?.data ?? r.data; setCriteria(data ?? null); })
      .catch(() => setCriteria(null));
  }, [form.campaignId]);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const setResponse = (fieldId: string, value: string) =>
    setResponses(r => ({ ...r, [fieldId]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = {
        ...form,
        startAt: new Date(form.startAt).toISOString(),
        endAt:   new Date(form.endAt).toISOString(),
        ...(Object.keys(responses).length ? {
          responses: Object.entries(responses)
            .filter(([, v]) => v !== '')
            .map(([fieldId, value]) => ({ fieldId, value })),
        } : {}),
      };
      if (isEdit) await api.patch(`/agenda/${initial!.id}`, payload);
      else        await api.post('/agenda', payload);
      onSaved();
    } finally { setSaving(false); }
  };

  const hasCriteria = criteria && criteria.fields.length > 0;

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-h-[90vh] overflow-y-auto ${hasCriteria ? 'max-w-2xl' : 'max-w-lg'}`}>
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {isEdit ? 'Modifier le RDV' : 'Nouveau RDV'}
            </Dialog.Title>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Champs de base */}
            <div>
              <label className="label">Titre *</label>
              <input type="text" value={form.title} onChange={set('title')} className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Agent *</label>
                <select value={form.agentId} onChange={set('agentId')} className="input-field" required>
                  <option value="">Sélectionner…</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Statut</label>
                <select value={form.status} onChange={set('status')} className="input-field">
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Début *</label>
                <input type="datetime-local" value={form.startAt} onChange={set('startAt')} className="input-field" required />
              </div>
              <div>
                <label className="label">Fin *</label>
                <input type="datetime-local" value={form.endAt} onChange={set('endAt')} className="input-field" required />
              </div>
              <div>
                <label className="label">Campagne</label>
                <select value={form.campaignId} onChange={set('campaignId')} className="input-field">
                  <option value="">— aucune —</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Client</label>
                <select value={form.clientId} onChange={set('clientId')} className="input-field">
                  <option value="">— aucun —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={set('description')} rows={2} className="input-field resize-none" />
            </div>

            {/* Critères dynamiques */}
            {hasCriteria && (
              <div className="border border-primary-100 rounded-xl bg-primary-50/40 p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Star size={14} className="text-primary-600" />
                  <span className="text-sm font-semibold text-primary-800">{criteria.name}</span>
                  <span className="text-xs text-primary-500 ml-auto">Score min OK : {criteria.minScoreOk}%</span>
                </div>
                {criteria.fields.map(field => (
                  <div key={field.id ?? field.key}>
                    <label className="label text-xs">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-0.5">*</span>}
                      <span className="text-gray-400 font-normal ml-1">(poids ×{field.weight})</span>
                    </label>
                    <DynamicField
                      field={field}
                      value={responses[field.id ?? field.key] ?? ''}
                      onChange={v => setResponse(field.id ?? field.key, v)}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Enregistrement…' : isEdit ? 'Mettre à jour' : 'Créer le RDV'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
