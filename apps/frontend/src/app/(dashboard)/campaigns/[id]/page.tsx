'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, UserPlus, Trash2, UserMinus, Settings2,
  Tag, Plus, Pencil, Check, X, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { LeadImportModal } from '@/components/leads/lead-import-modal';
import { clsx } from 'clsx';

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

type Tab = 'leads' | 'settings' | 'qualifications';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('leads');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [qualifications, setQualifications] = useState<Qualification[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [showAgentPanel, setShowAgentPanel] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState<Partial<CampaignSettings>>({});

  const fetchData = useCallback(async () => {
    const [campRes, leadsRes, agentsRes, qualifRes] = await Promise.all([
      api.get(`/campaigns/${id}`),
      api.get(`/leads?campaignId=${id}&limit=100`),
      api.get('/users/agents/list'),
      api.get(`/campaigns/${id}/qualifications`),
    ]);
    const camp = campRes.data;
    setCampaign(camp);
    setLeads(leadsRes.data.data);
    setAllAgents(agentsRes.data);
    setQualifications(qualifRes.data);
    setSettings(camp.settings ?? {
      dialerMode: 'PROGRESSIVE', dialerSpeed: 1, maxSimultaneousCalls: 1,
      agentRatio: 1.0, maxAttempts: 3, retryDelayMin: 60, wrapUpTimeSec: 30,
      enableRecording: true, enableDnc: true, customQualifEnabled: false,
    });
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
          <button onClick={() => setShowAgentPanel(true)} className="flex items-center gap-1.5 btn-secondary text-sm">
            <UserPlus size={15} /> Agents
          </button>
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 btn-primary text-sm">
            <Upload size={15} /> Import CSV
          </button>
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
      <div className="flex border-b border-gray-200 gap-1">
        {([
          { key: 'leads', label: 'Leads', icon: null },
          { key: 'settings', label: 'Paramètres dialer', icon: <Settings2 size={14} /> },
          { key: 'qualifications', label: 'Qualifications', icon: <Tag size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
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
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Leads ({leads.length})</h3>
          </div>
          {leads.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              Aucun lead — importez un fichier CSV
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Nom', 'Email', 'Téléphone', 'Entreprise', 'Statut', 'Agent', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{lead.firstName} {lead.lastName}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.email ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500">{lead.company ?? '—'}</td>
                      <td className="px-4 py-3">
                        <select value={lead.status}
                          onChange={(e) => updateLeadStatus(lead.id, e.target.value)}
                          className={clsx('text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer', LEAD_STATUS_COLORS[lead.status])}>
                          {Object.entries(LEAD_STATUS_LABELS).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => removeLead(lead.id)} className="text-gray-300 hover:text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

      {/* Agent panel */}
      {showAgentPanel && (
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
