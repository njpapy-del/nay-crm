'use client';

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { api } from '@/lib/api';

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

export function AppointmentModal({ open, onClose, onSaved, initial }: Props) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState<FormData>({
    agentId: '', title: '', description: '', startAt: '', endAt: '',
    status: 'SCHEDULED', campaignId: '', clientId: '', ...initial,
  });
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [saving,    setSaving]    = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      api.get('/users?role=AGENT&limit=100'),
      api.get('/campaigns?status=ACTIVE&limit=100'),
      api.get('/clients?limit=100'),
    ]).then(([a, c, cl]) => { setAgents(a.data.data); setCampaigns(c.data.data); setClients(cl.data.data); });
  }, [open]);

  useEffect(() => { setForm({ agentId: '', title: '', description: '', startAt: '', endAt: '', status: 'SCHEDULED', campaignId: '', clientId: '', ...initial }); }, [initial]);

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, startAt: new Date(form.startAt).toISOString(), endAt: new Date(form.endAt).toISOString() };
      if (isEdit) await api.patch(`/agenda/${initial!.id}`, payload);
      else        await api.post('/agenda', payload);
      onSaved();
    } finally { setSaving(false); }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-bold text-gray-900">
              {isEdit ? 'Modifier le RDV' : 'Nouveau RDV'}
            </Dialog.Title>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="label">Titre *</label>
              <input type="text" value={form.title} onChange={set('title')} className="input-field" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Agent *</label>
                <select value={form.agentId} onChange={set('agentId')} className="input-field" required>
                  <option value="">Sélectionner…</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Statut</label>
                <select value={form.status} onChange={set('status')} className="input-field">
                  {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
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
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Client</label>
                <select value={form.clientId} onChange={set('clientId')} className="input-field">
                  <option value="">— aucun —</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Description</label>
              <textarea value={form.description} onChange={set('description')} rows={2} className="input-field resize-none" />
            </div>
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
