'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

const QUALIFS = ['SALE', 'APPOINTMENT', 'NOT_INTERESTED', 'CALLBACK', 'WRONG_NUMBER', 'VOICEMAIL', 'DNC', 'OTHER'];
const STATUSES = ['PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED'];

const QUALIF_LABEL: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'Rappel', WRONG_NUMBER: 'Faux numéro', VOICEMAIL: 'Messagerie',
  DNC: 'DNC', OTHER: 'Autre',
};

interface Agent    { id: string; firstName: string; lastName: string; }
interface Client   { id: string; firstName: string; lastName: string; company?: string; }
interface Campaign { id: string; name: string; }

interface SaleFormData {
  agentId: string; clientId: string; campaignId: string; callId: string;
  status: string; amount: string; qualification: string; notes: string; closedAt: string;
}

interface Props {
  initial?: Partial<SaleFormData>;
  onSubmit: (data: SaleFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

export function SaleForm({ initial, onSubmit, onCancel, loading }: Props) {
  const [form, setForm] = useState<SaleFormData>({
    agentId: '', clientId: '', campaignId: '', callId: '',
    status: 'PENDING', amount: '', qualification: 'SALE', notes: '', closedAt: '',
    ...initial,
  });

  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [clients,   setClients]   = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    Promise.all([
      api.get('/users?role=AGENT&limit=100'),
      api.get('/clients?limit=100'),
      api.get('/campaigns?status=ACTIVE&limit=100'),
    ]).then(([a, c, camp]) => {
      setAgents(a.data.data);
      setClients(c.data.data);
      setCampaigns(camp.data.data);
    });
  }, []);

  const set = (key: keyof SaleFormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(form); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Agent *</label>
          <select value={form.agentId} onChange={set('agentId')} className="input-field" required>
            <option value="">Sélectionner…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select value={form.clientId} onChange={set('clientId')} className="input-field">
            <option value="">— aucun —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` (${c.company})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Campagne</label>
          <select value={form.campaignId} onChange={set('campaignId')} className="input-field">
            <option value="">— aucune —</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Montant (€) *</label>
          <input type="number" min={0} step="0.01" value={form.amount} onChange={set('amount')} className="input-field" required />
        </div>
        <div>
          <label className="label">Qualification *</label>
          <select value={form.qualification} onChange={set('qualification')} className="input-field" required>
            {QUALIFS.map((q) => <option key={q} value={q}>{QUALIF_LABEL[q]}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Statut</label>
          <select value={form.status} onChange={set('status')} className="input-field">
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label">ID Appel lié</label>
          <input type="text" value={form.callId} onChange={set('callId')} className="input-field" placeholder="cuid…" />
        </div>
        <div>
          <label className="label">Date clôture</label>
          <input type="date" value={form.closedAt} onChange={set('closedAt')} className="input-field" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea value={form.notes} onChange={set('notes')} rows={3} className="input-field resize-none" />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Annuler</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  );
}
