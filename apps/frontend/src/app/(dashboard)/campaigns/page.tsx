'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Users, Target, PlayCircle, PauseCircle, Search, X } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  _count: { leads: number; appointments: number };
  agents: { agent: { firstName: string; lastName: string } }[];
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  ACTIVE: 'bg-green-100 text-green-700',
  PAUSED: 'bg-yellow-100 text-yellow-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-600',
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Brouillon', ACTIVE: 'Active', PAUSED: 'En pause',
  COMPLETED: 'Terminée', CANCELLED: 'Annulée',
};

const FILTERS = [
  { value: '', label: 'Toutes' },
  { value: 'ACTIVE', label: 'Actives' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'PAUSED', label: 'En pause' },
  { value: 'COMPLETED', label: 'Terminées' },
];

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('');
  const [search,    setSearch]    = useState('');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter)   params.set('status',   filter);
      if (search)   params.set('search',   search);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo',   dateTo);
      const res = await api.get(`/campaigns?${params}`);
      const d = res.data?.data ?? res.data;
      setCampaigns(Array.isArray(d) ? d : d.data ?? []);
      setTotal(res.data?.meta?.total ?? res.data?.data?.length ?? 0);
    } finally { setLoading(false); }
  }, [filter, search, dateFrom, dateTo]);

  const clearFilters = () => { setFilter(''); setSearch(''); setDateFrom(''); setDateTo(''); };

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const toggleStatus = async (c: Campaign) => {
    const next = c.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await api.patch(`/campaigns/${c.id}`, { status: next });
    fetchCampaigns();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagnes</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} campagnes au total</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle campagne
        </Link>
      </div>

      {/* Filtres */}
      <div className="space-y-3">
        {/* Recherche + dates */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une campagne…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 shrink-0">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300" />
            <label className="text-xs text-gray-500 shrink-0">Au</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-300" />
          </div>
          {(filter || search || dateFrom || dateTo) && (
            <button onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <X size={13} /> Réinitialiser
            </button>
          )}
        </div>

        {/* Filtres statut */}
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setFilter(f.value)}
              className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                filter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grille */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune campagne</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <div key={c.id} className="card p-5 space-y-3 hover:shadow-md transition-shadow">
              {/* Title + status */}
              <div className="flex items-start justify-between gap-2">
                <Link href={`/campaigns/${c.id}`} className="font-semibold text-gray-900 hover:text-primary-600 line-clamp-1">
                  {c.name}
                </Link>
                <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium shrink-0', STATUS_COLORS[c.status])}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>

              {c.description && <p className="text-sm text-gray-500 line-clamp-2">{c.description}</p>}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span className="flex items-center gap-1">
                  <Target size={14} className="text-primary-500" />
                  {c._count.leads} leads
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} className="text-purple-500" />
                  {c.agents.length} agents
                </span>
              </div>

              {/* Agents avatars */}
              {c.agents.length > 0 && (
                <div className="flex -space-x-2">
                  {c.agents.slice(0, 5).map((a, i) => (
                    <div key={i} title={`${a.agent.firstName} ${a.agent.lastName}`}
                      className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center border-2 border-white font-medium">
                      {a.agent.firstName[0]}{a.agent.lastName[0]}
                    </div>
                  ))}
                  {c.agents.length > 5 && (
                    <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center border-2 border-white">
                      +{c.agents.length - 5}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                <Link href={`/campaigns/${c.id}`} className="text-xs text-primary-600 font-medium hover:underline">
                  Voir les leads →
                </Link>
                {(c.status === 'ACTIVE' || c.status === 'PAUSED') && (
                  <button onClick={() => toggleStatus(c)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                    {c.status === 'ACTIVE' ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
