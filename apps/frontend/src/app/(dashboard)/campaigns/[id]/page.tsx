'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, UserPlus, Trash2, UserMinus, Settings2,
  Tag, Plus, Pencil, Check, X, Loader2, GitMerge, Filter, RefreshCw,
  BarChart2, Users, Wifi, WifiOff, Phone, CalendarCheck,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { StatusBadge } from '@/components/ui/status-badge';
import { LeadImportModal } from '@/components/leads/lead-import-modal';
import { clsx } from 'clsx';
import { CriteriaBuilder } from '@/components/campaign-criteria/criteria-builder';

interface Lead {
  id: string; firstName: string; lastName: string; email?: string;
  phone?: string; company?: string; status: string;
  assignedTo?: { id: string; firstName: string; lastName: string } | null;
}
interface Agent { id: string; firstName: string; lastName: string; email: string; }
interface Campaign {
  id: string; name: string; description?: string; status: string;
  _count: { leads: number; callLogs: number };
  agents: { agentId: string; agent: Agent }[];
  settings?: CampaignSettings | null;
}
interface CampaignSettings {
  dialerMode: string; dialerSpeed: number; maxSimultaneousCalls: number;
  agentRatio: number; maxAttempts: number; retryDelayMin: number;
  wrapUpTimeSec: number; enableRecording: boolean; enableDnc: boolean;
  customQualifEnabled: boolean;
}
interface Qualification {
  id: string; label: string; code: string; color: string;
  isPositive: boolean; position: number; isActive: boolean;
}
interface AgentStat {
  agentId: string;
  agent: Agent;
  status: string;
  isOnline: boolean;
  onCurrentCampaign: boolean;
  loginAt: string | null;
  stats: { totalCalls: number; rdvCount: number; avgCallDurationSec: number; tauxRdv: number };
}
interface CampaignKpi {
  totalCalls: number; tauxRdv: number; tauxTransformation: number;
  tauxRefus: number; tauxInjoignable: number; tauxConversion: number; tauxAnnulation: number;
  rdvTotal: number; rdvValid: number; rdvCancelled: number;
}
type Period = 'today' | 'week' | 'month' | 'custom';

const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau', CONTACTED: 'Contacté', QUALIFIED: 'Qualifié', CONVERTED: 'Converti', LOST: 'Perdu',
};
const LEAD_STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600', CONTACTED: 'bg-blue-100 text-blue-700',
  QUALIFIED: 'bg-yellow-100 text-yellow-700', CONVERTED: 'bg-green-100 text-green-700',
  LOST: 'bg-red-100 text-red-600',
};
const DIALER_MODES = [
  { value: 'MANUAL', label: 'Manuel' },
  { value: 'PROGRESSIVE', label: 'Progressif' },
  { value: 'PREDICTIVE', label: 'Prédictif' },
  { value: 'PREVIEW', label: 'Aperçu' },
];

type Tab = 'leads' | 'agents' | 'stats' | 'settings' | 'qualifications' | 'criteria';

function periodDates(period: Period, customFrom: string, customTo: string) {
  const now = new Date();
  if (period === 'today') {
    const d = now.toISOString().slice(0, 10);
    return { dateFrom: d, dateTo: d };
  }
  if (period === 'week') {
    const mon = new Date(now); mon.setDate(now.getDate() - now.getDay() + 1);
    return { dateFrom: mon.toISOString().slice(0, 10), dateTo: now.toISOString().slice(0, 10) };
  }
  if (period === 'month') {
    return { dateFrom: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, dateTo: now.toISOString().slice(0, 10) };
  }
  return { dateFrom: customFrom, dateTo: customTo };
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const isManager = currentUser?.role === 'ADMIN' || currentUser?.role === 'MANAGER';
  const [tab, setTab] = useState<Tab>('leads');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [showImport,    setShowImport]    = useState(false);
  const [showAgentPanel,setShowAgentPanel]= useState(false);
  const [loading,       setLoading]       = useState(true);
  const [savingSettings,setSavingSettings]= useState(false);
  const [settings,      setSettings]      = useState<Partial<CampaignSettings>>({});
  const [leadFilter,    setLeadFilter]    = useState('');
  const [deduping,      setDeduping]      = useState(false);
  const [dedupeResult,  setDedupeResult]  = useState<{ removed: number } | null>(null);
  const [recycling,     setRecycling]     = useState(false);
  const [recycleResult, setRecycleResult] = useState<{ recycled: number } | null>(null);
  const [recycleMode,   setRecycleMode]   = useState<'not_reached' | 'failed_calls' | 'all'>('all');

  // Agents tab
  const [agentStats,    setAgentStats]    = useState<AgentStat[]>([]);
  const [agentPeriod,   setAgentPeriod]   = useState<Period>('month');
  const [agentCustomFrom, setAgentCustomFrom] = useState('');
  const [agentCustomTo,   setAgentCustomTo]   = useState('');
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Stats tab
  const [kpi,           setKpi]           = useState<CampaignKpi | null>(null);
  const [byQualif,      setByQualif]      = useState<Record<string, number>>({});
  const [statsPeriod,   setStatsPeriod]   = useState<Period>('month');
  const [statsCustomFrom, setStatsCustomFrom] = useState('');
  const [statsCustomTo,   setStatsCustomTo]   = useState('');
  const [statsAgentId,  setStatsAgentId]  = useState('');
  const [loadingStats,  setLoadingStats]  = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [campRes, leadsRes, agentsRes, qualifRes] = await Promise.allSettled([
        api.get(`/campaigns/${id}`),
        api.get(`/leads?campaignId=${id}&limit=100`),
        isManager ? api.get('/users/agents/list') : Promise.resolve({ data: { data: [] } }),
        api.get(`/campaigns/${id}/qualifications`),
      ]);
      const camp = campRes.status === 'fulfilled' ? (campRes.value.data?.data ?? campRes.value.data) : null;
      if (camp) {
        setCampaign(camp);
        setSettings(camp.settings ?? {
          dialerMode: 'PROGRESSIVE', dialerSpeed: 1, maxSimultaneousCalls: 1,
          agentRatio: 1.0, maxAttempts: 3, retryDelayMin: 60, wrapUpTimeSec: 30,
          enableRecording: true, enableDnc: true, customQualifEnabled: false,
        });
      }
      if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.data?.data?.data ?? leadsRes.value.data?.data ?? []);
      if (agentsRes.status === 'fulfilled') setAllAgents(agentsRes.value.data?.data ?? agentsRes.value.data ?? []);
      if (qualifRes.status === 'fulfilled') setQualifications(qualifRes.value.data?.data ?? qualifRes.value.data ?? []);
    } catch (e: any) {
      console.error('[campaign detail]', e?.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchAgentStats = useCallback(async () => {
    setLoadingAgents(true);
    try {
      const { dateFrom, dateTo } = periodDates(agentPeriod, agentCustomFrom, agentCustomTo);
      const params = new URLSearchParams();
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo)   params.set('dateTo', dateTo);
      const res = await api.get(`/campaigns/${id}/agents/stats?${params}`);
      setAgentStats(res.data?.data ?? []);
    } catch (e: any) {
      console.error('[agent stats]', e?.message);
    } finally {
      setLoadingAgents(false); }
  }, [id, agentPeriod, agentCustomFrom, agentCustomTo]);

  const fetchCampaignKpi = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { dateFrom, dateTo } = periodDates(statsPeriod, statsCustomFrom, statsCustomTo);
      const params = new URLSearchParams();
      if (dateFrom)    params.set('dateFrom', dateFrom);
      if (dateTo)      params.set('dateTo', dateTo);
      if (statsAgentId) params.set('agentId', statsAgentId);
      const res = await api.get(`/campaigns/${id}/stats/kpi?${params}`);
      const d = res.data?.data ?? res.data;
      setKpi(d.kpi ?? null);
      setByQualif(d.byQualification ?? {});
    } catch (e: any) {
      console.error('[campaign kpi]', e?.message);
    } finally {
      setLoadingStats(false);
    }
  }, [id, statsPeriod, statsCustomFrom, statsCustomTo, statsAgentId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'agents') fetchAgentStats(); }, [tab, fetchAgentStats]);
  useEffect(() => { if (tab === 'stats')  fetchCampaignKpi(); }, [tab, fetchCampaignKpi]);

  const updateLeadStatus = async (leadId: string, status: string) => {
    await api.patch(`/leads/${leadId}`, { status });
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status } : l));
  };

  const assignAgent = async (agentId: string) => {
    await api.post(`/campaigns/${id}/agents`, { agentIds: [agentId] });
    fetchData();
  };

  const removeAgent = async (agentId: string) => {
    await api.delete(`/campaigns/${id}/agents/${agentId}`);
    fetchData();
  };

  const removeLead = async (leadId: string) => {
    if (!confirm('Supprimer ce lead ?')) return;
    await api.delete(`/leads/${leadId}`);
    setLeads((prev) => prev.filter((l) => l.id !== leadId));
  };

  const deduplicate = async () => {
    if (!confirm('Supprimer les leads en double (même téléphone ou même email) ?')) return;
    setDeduping(true);
    setDedupeResult(null);
    try {
      const res = await api.post(`/campaigns/${id}/deduplicate`);
      const result = res.data?.data ?? res.data;
      setDedupeResult(result);
      if (result.removed > 0) fetchData();
    } finally { setDeduping(false); }
  };

  const recycle = async () => {
    setRecycling(true);
    setRecycleResult(null);
    try {
      const res = await api.post(`/campaigns/${id}/recycle`, { mode: recycleMode });
      const result = res.data?.data ?? res.data;
      setRecycleResult(result);
      if (result.recycled > 0) fetchData();
    } finally { setRecycling(false); }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.patch(`/campaigns/${id}/settings`, settings);
      fetchData();
    } finally { setSavingSettings(false); }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Chargement...</div>;
  if (!campaign) return null;

  const assignedIds = new Set(campaign.agents.map((a) => a.agentId));
  const availableAgents = allAgents.filter((a) => !assignedIds.has(a.id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-1.5 rounded hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{campaign.name}</h1>
            <StatusBadge status={campaign.status} type="campaign" />
          </div>
          {campaign.description && <p className="text-gray-500 text-sm mt-1">{campaign.description}</p>}
        </div>
        <div className="flex gap-2">
          {isManager && (
            <>
              <button onClick={() => setShowAgentPanel(true)} className="flex items-center gap-1.5 btn-secondary text-sm">
                <UserPlus size={15} /> Agents
              </button>
              <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 btn-primary text-sm">
                <Upload size={15} /> Import CSV
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Leads', val: campaign._count.leads },
          { label: 'Appels journalisés', val: campaign._count.callLogs },
          { label: 'Agents', val: campaign.agents.length },
          { label: 'Tentatives max', val: settings.maxAttempts ?? 3 },
        ].map((s) => (
          <div key={s.label} className="card p-3 text-center">
            <p className="text-2xl font-bold text-gray-800">{s.val}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1 overflow-x-auto">
        {([
          { key: 'leads',          label: 'Leads',             icon: null },
          { key: 'agents',         label: 'Agents',            icon: <Users size={14} /> },
          { key: 'stats',          label: 'Stats & KPI',       icon: <BarChart2 size={14} /> },
          ...(isManager ? [
            { key: 'settings',     label: 'Paramètres dialer', icon: <Settings2 size={14} /> },
            { key: 'qualifications',label: 'Qualifications',   icon: <Tag size={14} /> },
            { key: 'criteria',     label: 'Critères RDV',      icon: <Filter size={14} /> },
          ] : []),
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab: Leads */}
      {tab === 'leads' && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
            <h3 className="font-semibold text-gray-900 shrink-0">
              Leads ({leadFilter ? leads.filter(l => l.status === leadFilter).length : leads.length})
            </h3>

            {/* Filtre statut */}
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-gray-400" />
              <select
                value={leadFilter}
                onChange={(e) => setLeadFilter(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>

            {/* Dédoublonnage + Recyclage — managers uniquement */}
            {isManager && (
              <>
                <button
                  onClick={deduplicate}
                  disabled={deduping || leads.length === 0}
                  className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-40 transition-colors"
                >
                  {deduping ? <Loader2 size={13} className="animate-spin" /> : <GitMerge size={13} />}
                  Dédoublonner
                </button>
                {dedupeResult && (
                  <span className={clsx('text-xs font-medium px-2 py-1 rounded-full',
                    dedupeResult.removed > 0 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                    {dedupeResult.removed > 0
                      ? `${dedupeResult.removed} doublon${dedupeResult.removed > 1 ? 's' : ''} supprimé${dedupeResult.removed > 1 ? 's' : ''}`
                      : 'Aucun doublon détecté'}
                  </span>
                )}
                <div className="flex items-center gap-1.5 border-l border-gray-200 pl-3">
                  <select value={recycleMode} onChange={(e) => setRecycleMode(e.target.value as typeof recycleMode)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white">
                    <option value="not_reached">Non joints</option>
                    <option value="failed_calls">Appels échoués</option>
                    <option value="all">Tous (non joints + échoués)</option>
                  </select>
                  <button onClick={recycle} disabled={recycling || leads.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-40 transition-colors">
                    {recycling ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    Recycler
                  </button>
                  {recycleResult && (
                    <span className={clsx('text-xs font-medium px-2 py-1 rounded-full',
                      recycleResult.recycled > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600')}>
                      {recycleResult.recycled > 0
                        ? `${recycleResult.recycled} lead${recycleResult.recycled > 1 ? 's' : ''} recyclé${recycleResult.recycled > 1 ? 's' : ''}`
                        : 'Aucun lead à recycler'}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {leads.filter((l) => !leadFilter || l.status === leadFilter).length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Aucun lead — importez un fichier CSV
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Nom', 'Email', 'Téléphone', 'Entreprise', 'Statut', 'Agent', ...(isManager ? [''] : [])].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.filter((l) => !leadFilter || l.status === leadFilter).map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lead.firstName} {lead.lastName}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.company ?? '—'}</td>
                      <td className="px-4 py-3">
                        {isManager ? (
                          <select value={lead.status}
                            onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                            className={clsx('text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer', LEAD_STATUS_COLORS[lead.status])}>
                            {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>{l}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={clsx('text-xs font-medium px-2 py-1 rounded-full', LEAD_STATUS_COLORS[lead.status])}>
                            {LEAD_STATUS_LABELS[lead.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '—'}
                      </td>
                      {isManager && (
                        <td className="px-4 py-3">
                          <button onClick={() => removeLead(lead.id)} className="text-gray-300 hover:text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Agents */}
      {tab === 'agents' && (
        <div className="space-y-4">
          {/* Filtres période */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Période :</span>
            {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <button key={p} onClick={() => setAgentPeriod(p)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  agentPeriod === p ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Cette semaine' : p === 'month' ? 'Ce mois' : 'Personnalisé'}
              </button>
            ))}
            {agentPeriod === 'custom' && (
              <>
                <input type="date" value={agentCustomFrom} onChange={(e) => setAgentCustomFrom(e.target.value)}
                  className="input-field text-xs py-1.5" />
                <input type="date" value={agentCustomTo} onChange={(e) => setAgentCustomTo(e.target.value)}
                  className="input-field text-xs py-1.5" />
              </>
            )}
            <button onClick={fetchAgentStats} disabled={loadingAgents}
              className="ml-auto flex items-center gap-1.5 btn-secondary text-xs">
              {loadingAgents ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Actualiser
            </button>
          </div>

          {/* Tableau agents */}
          <div className="card overflow-hidden">
            {loadingAgents ? (
              <div className="p-8 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
            ) : agentStats.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Aucun agent assigné à cette campagne</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Agent', 'Statut', 'Appels', 'RDV', 'Durée moy.', 'Taux RDV'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {agentStats.map((a) => (
                      <tr key={a.agentId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium shrink-0">
                              {a.agent.firstName[0]}{a.agent.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{a.agent.firstName} {a.agent.lastName}</p>
                              <p className="text-xs text-gray-400">{a.agent.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full',
                            a.isOnline
                              ? a.status === 'IN_CALL' ? 'bg-red-100 text-red-700'
                              : a.status === 'PAUSED'  ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500')}>
                            {a.isOnline
                              ? <Wifi size={11} />
                              : <WifiOff size={11} />}
                            {a.isOnline
                              ? a.status === 'IN_CALL'   ? 'En appel'
                              : a.status === 'PAUSED'    ? 'En pause'
                              : a.status === 'WRAP_UP'   ? 'Post-appel'
                              : 'Disponible'
                              : 'Hors ligne'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-gray-900 font-medium">
                            <Phone size={13} className="text-gray-400" />{a.stats.totalCalls}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-gray-900 font-medium">
                            <CalendarCheck size={13} className="text-green-500" />{a.stats.rdvCount}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">
                          {a.stats.avgCallDurationSec > 0
                            ? `${Math.floor(a.stats.avgCallDurationSec / 60)}m${String(a.stats.avgCallDurationSec % 60).padStart(2, '0')}s`
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 max-w-20 bg-gray-100 rounded-full h-1.5">
                              <div className="bg-primary-500 h-1.5 rounded-full"
                                style={{ width: `${Math.min(a.stats.tauxRdv, 100)}%` }} />
                            </div>
                            <span className="text-xs font-medium text-gray-700 w-10 text-right">{a.stats.tauxRdv}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {agentStats.length > 1 && (
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-600" colSpan={2}>Total</td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800">
                          {agentStats.reduce((s, a) => s + a.stats.totalCalls, 0)}
                        </td>
                        <td className="px-4 py-2 text-xs font-semibold text-gray-800">
                          {agentStats.reduce((s, a) => s + a.stats.rdvCount, 0)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Stats & KPI */}
      {tab === 'stats' && (
        <div className="space-y-4">
          {/* Filtres */}
          <div className="card p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700">Période :</span>
            {(['today', 'week', 'month', 'custom'] as Period[]).map((p) => (
              <button key={p} onClick={() => setStatsPeriod(p)}
                className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statsPeriod === p ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
                {p === 'today' ? "Aujourd'hui" : p === 'week' ? 'Cette semaine' : p === 'month' ? 'Ce mois' : 'Personnalisé'}
              </button>
            ))}
            {statsPeriod === 'custom' && (
              <>
                <input type="date" value={statsCustomFrom} onChange={(e) => setStatsCustomFrom(e.target.value)}
                  className="input-field text-xs py-1.5" />
                <input type="date" value={statsCustomTo} onChange={(e) => setStatsCustomTo(e.target.value)}
                  className="input-field text-xs py-1.5" />
              </>
            )}
            {campaign.agents.length > 0 && (
              <select value={statsAgentId} onChange={(e) => setStatsAgentId(e.target.value)}
                className="input-field text-xs py-1.5 ml-2">
                <option value="">Tous les agents</option>
                {campaign.agents.map(({ agentId, agent }) => (
                  <option key={agentId} value={agentId}>{agent.firstName} {agent.lastName}</option>
                ))}
              </select>
            )}
            <button onClick={fetchCampaignKpi} disabled={loadingStats}
              className="ml-auto flex items-center gap-1.5 btn-secondary text-xs">
              {loadingStats ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Actualiser
            </button>
          </div>

          {loadingStats ? (
            <div className="p-8 text-center text-gray-400"><Loader2 size={20} className="animate-spin mx-auto" /></div>
          ) : kpi ? (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Total appels',    val: kpi.totalCalls,         unit: '',  color: 'text-gray-800' },
                  { label: 'Taux RDV',        val: kpi.tauxRdv,            unit: '%', color: 'text-primary-700' },
                  { label: 'Transformation',  val: kpi.tauxTransformation, unit: '%', color: 'text-green-700' },
                  { label: 'Taux refus',      val: kpi.tauxRefus,          unit: '%', color: 'text-red-600' },
                  { label: 'Injoignable',     val: kpi.tauxInjoignable,    unit: '%', color: 'text-yellow-700' },
                  { label: 'Annulation',      val: kpi.tauxAnnulation,     unit: '%', color: 'text-orange-600' },
                ].map((k) => (
                  <div key={k.label} className="card p-4 text-center">
                    <p className={clsx('text-2xl font-bold', k.color)}>{k.val}{k.unit}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
                  </div>
                ))}
              </div>

              {/* RDV summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'RDV pris',      val: kpi.rdvTotal,     color: 'bg-primary-50 text-primary-800' },
                  { label: 'RDV validés',   val: kpi.rdvValid,     color: 'bg-green-50 text-green-800' },
                  { label: 'RDV annulés',   val: kpi.rdvCancelled, color: 'bg-red-50 text-red-800' },
                ].map((r) => (
                  <div key={r.label} className={clsx('card p-4 text-center rounded-xl', r.color)}>
                    <p className="text-3xl font-bold">{r.val}</p>
                    <p className="text-xs mt-0.5 font-medium">{r.label}</p>
                  </div>
                ))}
              </div>

              {/* Qualification breakdown */}
              {Object.keys(byQualif).length > 0 && (
                <div className="card p-5 space-y-3">
                  <h3 className="font-semibold text-gray-900 text-sm">Répartition par qualification</h3>
                  <div className="space-y-2">
                    {Object.entries(byQualif)
                      .sort(([, a], [, b]) => b - a)
                      .map(([qualif, count]) => {
                        const pct = kpi.totalCalls > 0 ? (count / kpi.totalCalls) * 100 : 0;
                        return (
                          <div key={qualif} className="flex items-center gap-3">
                            <span className="w-36 text-xs text-gray-600 font-medium truncate">{qualif}</span>
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div className="bg-primary-400 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs text-gray-500 w-16 text-right">
                              {count} <span className="text-gray-400">({pct.toFixed(1)}%)</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card p-8 text-center text-gray-400">Aucune donnée sur la période sélectionnée</div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {tab === 'settings' && (
        <div className="card p-6 space-y-6 max-w-2xl">
          <h3 className="font-semibold text-gray-900">Configuration du dialer</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mode dialer</label>
              <select value={settings.dialerMode ?? 'PROGRESSIVE'}
                onChange={(e) => setSettings((s) => ({ ...s, dialerMode: e.target.value }))}
                className="input-field mt-1 w-full">
                {DIALER_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Vitesse (appels/min)</label>
              <input type="number" min={1} max={100}
                value={settings.dialerSpeed ?? 1}
                onChange={(e) => setSettings((s) => ({ ...s, dialerSpeed: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Appels simultanés max</label>
              <input type="number" min={1} max={50}
                value={settings.maxSimultaneousCalls ?? 1}
                onChange={(e) => setSettings((s) => ({ ...s, maxSimultaneousCalls: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Ratio agents</label>
              <input type="number" min={0.1} max={10} step={0.1}
                value={settings.agentRatio ?? 1}
                onChange={(e) => setSettings((s) => ({ ...s, agentRatio: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Tentatives max par contact</label>
              <input type="number" min={1} max={20}
                value={settings.maxAttempts ?? 3}
                onChange={(e) => setSettings((s) => ({ ...s, maxAttempts: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Délai re-tentative (min)</label>
              <input type="number" min={1} max={10080}
                value={settings.retryDelayMin ?? 60}
                onChange={(e) => setSettings((s) => ({ ...s, retryDelayMin: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Temps post-appel (sec)</label>
              <input type="number" min={0} max={600}
                value={settings.wrapUpTimeSec ?? 30}
                onChange={(e) => setSettings((s) => ({ ...s, wrapUpTimeSec: +e.target.value }))}
                className="input-field mt-1 w-full" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {[
              { key: 'enableRecording' as const, label: 'Activer l\'enregistrement automatique' },
              { key: 'enableDnc' as const, label: 'Vérifier la liste DNC avant chaque appel' },
              { key: 'customQualifEnabled' as const, label: 'Utiliser les qualifications personnalisées' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox"
                  checked={!!(settings as any)[key]}
                  onChange={(e) => setSettings((s) => ({ ...s, [key]: e.target.checked }))}
                  className="w-4 h-4 rounded text-primary-600" />
                <span className="text-sm text-gray-700">{label}</span>
              </label>
            ))}
          </div>

          <button onClick={saveSettings} disabled={savingSettings}
            className="btn-primary flex items-center gap-2 disabled:opacity-50">
            {savingSettings ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Enregistrer les paramètres
          </button>
        </div>
      )}

      {/* Tab: Qualifications */}
      {tab === 'qualifications' && (
        <QualificationsPanel campaignId={id} qualifications={qualifications} onRefresh={fetchData} />
      )}

      {/* Tab: Critères RDV */}
      {tab === 'criteria' && (
        <CriteriaBuilder campaignId={id} />
      )}

      {/* Agent panel */}
      {isManager && showAgentPanel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Agents assignés</h2>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {campaign.agents.map(({ agentId, agent }) => (
                <div key={agentId} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium">
                      {agent.firstName[0]}{agent.lastName[0]}
                    </div>
                    <span className="text-sm text-gray-700">{agent.firstName} {agent.lastName}</span>
                  </div>
                  <button onClick={() => removeAgent(agentId)} className="text-gray-300 hover:text-red-500">
                    <UserMinus size={14} />
                  </button>
                </div>
              ))}
            </div>
            {availableAgents.length > 0 && (
              <>
                <p className="text-xs text-gray-500 font-semibold uppercase">Ajouter</p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {availableAgents.map((a) => (
                    <button key={a.id} onClick={() => assignAgent(a.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-primary-50 text-left">
                      <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-medium">
                        {a.firstName[0]}{a.lastName[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{a.firstName} {a.lastName}</div>
                        <div className="text-xs text-gray-400">{a.email}</div>
                      </div>
                      <Plus size={14} className="ml-auto text-primary-500" />
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => setShowAgentPanel(false)} className="btn-secondary w-full">Fermer</button>
          </div>
        </div>
      )}

      {showImport && (
        <LeadImportModal campaignId={id} onClose={() => setShowImport(false)} onImported={fetchData} />
      )}
    </div>
  );
}

// ─── Qualifications Panel ───────────────────────────────────────────────────

function QualificationsPanel({
  campaignId, qualifications, onRefresh,
}: {
  campaignId: string;
  qualifications: Qualification[];
  onRefresh: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: '', code: '', color: '#6b7280', isPositive: false });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (editId) {
        await api.patch(`/campaigns/qualifications/${editId}`, form);
      } else {
        await api.post('/campaigns/qualifications', { ...form, campaignId });
      }
      setAdding(false); setEditId(null);
      setForm({ label: '', code: '', color: '#6b7280', isPositive: false });
      onRefresh();
    } finally { setSaving(false); }
  };

  const del = async (qId: string) => {
    if (!confirm('Supprimer cette qualification ?')) return;
    await api.delete(`/campaigns/qualifications/${qId}`);
    onRefresh();
  };

  const startEdit = (q: Qualification) => {
    setEditId(q.id);
    setForm({ label: q.label, code: q.code, color: q.color, isPositive: q.isPositive });
    setAdding(true);
  };

  return (
    <div className="card p-6 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Qualifications personnalisées</h3>
        <button onClick={() => { setAdding(true); setEditId(null); setForm({ label: '', code: '', color: '#6b7280', isPositive: false }); }}
          className="btn-primary text-sm flex items-center gap-1">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {adding && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Libellé</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="Ex: Vente confirmée" className="input-field mt-1 w-full" />
            </div>
            <div>
              <label className="label">Code</label>
              <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="Ex: SALE_CONFIRMED" className="input-field mt-1 w-full font-mono" />
            </div>
            <div>
              <label className="label">Couleur</label>
              <div className="flex items-center gap-2 mt-1">
                <input type="color" value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 rounded border border-gray-300 cursor-pointer p-0.5" />
                <span className="text-xs text-gray-500 font-mono">{form.color}</span>
              </div>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.isPositive}
                  onChange={(e) => setForm((f) => ({ ...f, isPositive: e.target.checked }))}
                  className="w-4 h-4 rounded text-green-600" />
                <span className="text-sm text-gray-700">Résultat positif</span>
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving || !form.label || !form.code}
              className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              {editId ? 'Modifier' : 'Créer'}
            </button>
            <button onClick={() => { setAdding(false); setEditId(null); }} className="btn-secondary text-sm">
              <X size={12} className="inline mr-1" />Annuler
            </button>
          </div>
        </div>
      )}

      {qualifications.length === 0 && !adding ? (
        <p className="text-sm text-gray-400 py-4 text-center">
          Aucune qualification personnalisée — les qualifications globales seront utilisées
        </p>
      ) : (
        <div className="divide-y divide-gray-100">
          {qualifications.map((q) => (
            <div key={q.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full inline-block shrink-0" style={{ background: q.color }} />
                <div>
                  <span className="text-sm font-medium text-gray-900">{q.label}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{q.code}</span>
                </div>
                {q.isPositive && (
                  <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">Positif</span>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEdit(q)} className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                  <Pencil size={13} />
                </button>
                <button onClick={() => del(q.id)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
