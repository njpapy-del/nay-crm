'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const STATUSES = [
  { value: '',          label: 'Tous statuts' },
  { value: 'PENDING',   label: 'En attente' },
  { value: 'CONFIRMED', label: 'Confirmée' },
  { value: 'CANCELLED', label: 'Annulée' },
  { value: 'REFUNDED',  label: 'Remboursée' },
];

const QUALIFS = [
  { value: '',                label: 'Toutes qualifs' },
  { value: 'SALE',            label: 'Vente' },
  { value: 'APPOINTMENT',     label: 'RDV' },
  { value: 'NOT_INTERESTED',  label: 'Pas intéressé' },
  { value: 'CALLBACK',        label: 'Rappel' },
];

interface Filters {
  agentId: string; campaignId: string; status: string;
  qualification: string; from: string; to: string;
  minAmount: string; maxAmount: string;
}

interface Props { value: Filters; onChange: (f: Filters) => void; isAgent?: boolean; }
interface Agent { id: string; firstName: string; lastName: string; }
interface Campaign { id: string; name: string; }

export function SaleFilters({ value, onChange, isAgent = false }: Props) {
  const [agents,    setAgents]    = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    const requests = isAgent
      ? [Promise.resolve(null), api.get('/campaigns?limit=100')]
      : [api.get('/users?role=AGENT&limit=100'), api.get('/campaigns?limit=100')];
    Promise.allSettled(requests).then(([a, c]) => {
      if (!isAgent && a.status === 'fulfilled' && a.value)
        setAgents(a.value.data?.data ?? a.value.data ?? []);
      if (c.status === 'fulfilled' && c.value)
        setCampaigns(c.value.data?.data ?? c.value.data ?? []);
    });
  }, [isAgent]);

  const set = useCallback((key: keyof Filters) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    onChange({ ...value, [key]: e.target.value });
  }, [value, onChange]);

  return (
    <div className="flex flex-wrap gap-2 items-end">
      {!isAgent && (
        <select value={value.agentId} onChange={set('agentId')} className="input-field text-sm h-9 w-44">
          <option value="">Tous agents</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
        </select>
      )}

      <select value={value.campaignId} onChange={set('campaignId')} className="input-field text-sm h-9 w-44">
        <option value="">Toutes campagnes</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      <select value={value.status} onChange={set('status')} className="input-field text-sm h-9 w-36">
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>

      <select value={value.qualification} onChange={set('qualification')} className="input-field text-sm h-9 w-36">
        {QUALIFS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
      </select>

      <div className="flex items-center gap-1">
        <input type="date" value={value.from} onChange={set('from')} className="input-field text-sm h-9 w-36" />
        <span className="text-gray-400 text-xs">→</span>
        <input type="date" value={value.to}   onChange={set('to')}   className="input-field text-sm h-9 w-36" />
      </div>

      <div className="flex items-center gap-1">
        <input type="number" placeholder="Min €" value={value.minAmount} onChange={set('minAmount')}
          className="input-field text-sm h-9 w-24" min={0} />
        <span className="text-gray-400 text-xs">—</span>
        <input type="number" placeholder="Max €" value={value.maxAmount} onChange={set('maxAmount')}
          className="input-field text-sm h-9 w-24" min={0} />
      </div>

      <button onClick={() => onChange({ agentId: '', campaignId: '', status: '', qualification: '', from: '', to: '', minAmount: '', maxAmount: '' })}
        className={clsx('text-xs text-gray-400 hover:text-gray-600 px-2 h-9', 'transition-colors')}>
        Réinitialiser
      </button>
    </div>
  );
}
