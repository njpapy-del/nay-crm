'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart2, Download, Play, Plus, Trash2, Save,
  Loader2, ChevronDown, ChevronUp, FileSpreadsheet, FileText,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SavedReport { id: string; name: string; description?: string; updatedAt: string; config: ReportConfig; }
interface ReportConfig {
  dateFrom: string; dateTo: string; agentId?: string; campaignId?: string;
  metrics: string[]; groupBy?: string;
}
interface Agent { id: string; firstName: string; lastName: string; }
interface Campaign { id: string; name: string; }

const ALL_METRICS = [
  { key: 'totalCalls', label: 'Total appels' }, { key: 'answeredCalls', label: 'Appels décrochés' },
  { key: 'missedCalls', label: 'Appels manqués' }, { key: 'avgCallDurationSec', label: 'Durée moy. (sec)' },
  { key: 'appointmentsSet', label: 'RDV pris' }, { key: 'appointmentsValid', label: 'RDV validés' },
  { key: 'appointmentsCancelled', label: 'RDV annulés' }, { key: 'sales', label: 'Ventes' },
  { key: 'revenue', label: 'CA (€)' }, { key: 'hcCount', label: 'Hors Cible' },
  { key: 'ttr', label: 'TTR %' }, { key: 'tpr', label: 'TPR (RDV/j)' },
  { key: 'tauxHc', label: 'Taux HC %' }, { key: 'tauxContact', label: 'Taux Contact %' },
  { key: 'tauAnnulation', label: "Taux Annulation %" }, { key: 'productivite', label: 'Productivité (app/h)' },
];

const GROUP_BY_OPTIONS = [
  { value: '', label: 'Global' }, { value: 'agent', label: 'Par agent' }, { value: 'campaign', label: 'Par campagne' },
];

// ─── Report Builder ───────────────────────────────────────────────────────────

function ReportBuilder({ agents, campaigns, onRun }: {
  agents: Agent[]; campaigns: Campaign[];
  onRun: (config: ReportConfig) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = (() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; })();

  const [config, setConfig] = useState<ReportConfig>({
    dateFrom: monthStart, dateTo: today, metrics: ['totalCalls','ttr','tpr','revenue'], groupBy: '',
  });
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  const toggleMetric = (key: string) =>
    setConfig((c) => ({ ...c, metrics: c.metrics.includes(key) ? c.metrics.filter((m) => m !== key) : [...c.metrics, key] }));

  const save = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    try { await api.post('/reporting', { name: saveName, config }); setShowSave(false); setSaveName(''); }
    finally { setSaving(false); }
  };

  const exportFile = async (format: 'csv' | 'xlsx') => {
    const endpoint = format === 'csv' ? '/reporting/export/csv' : '/reporting/export/xlsx';
    const body = format === 'xlsx' ? { config, name: 'Rapport LNAYCRM' } : config;
    const res = await api.post(endpoint, body, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url;
    a.download = `rapport.${format}`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-5 space-y-5">
      <h2 className="font-semibold text-gray-900 flex items-center gap-2"><BarChart2 size={16} /> Constructeur de rapport</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label className="label">Date début</label>
          <input type="date" value={config.dateFrom}
            onChange={(e) => setConfig((c) => ({ ...c, dateFrom: e.target.value }))}
            className="input-field mt-1 w-full text-sm" />
        </div>
        <div>
          <label className="label">Date fin</label>
          <input type="date" value={config.dateTo}
            onChange={(e) => setConfig((c) => ({ ...c, dateTo: e.target.value }))}
            className="input-field mt-1 w-full text-sm" />
        </div>
        <div>
          <label className="label">Agent</label>
          <select value={config.agentId ?? ''} onChange={(e) => setConfig((c) => ({ ...c, agentId: e.target.value || undefined }))}
            className="input-field mt-1 w-full text-sm">
            <option value="">Tous</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Campagne</label>
          <select value={config.campaignId ?? ''} onChange={(e) => setConfig((c) => ({ ...c, campaignId: e.target.value || undefined }))}
            className="input-field mt-1 w-full text-sm">
            <option value="">Toutes</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Grouper par</label>
        <div className="flex gap-2 mt-1">
          {GROUP_BY_OPTIONS.map((g) => (
            <button key={g.value} onClick={() => setConfig((c) => ({ ...c, groupBy: g.value }))}
              className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                config.groupBy === g.value ? 'bg-primary-600 text-white border-primary-600' : 'text-gray-600 border-gray-200 hover:border-primary-300')}>
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Métriques</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {ALL_METRICS.map((m) => (
            <button key={m.key} onClick={() => toggleMetric(m.key)}
              className={clsx('px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                config.metrics.includes(m.key) ? 'bg-primary-100 text-primary-700 border-primary-300' : 'text-gray-500 border-gray-200 hover:border-gray-300')}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => onRun(config)} className="btn-primary flex items-center gap-2">
          <Play size={14} /> Générer
        </button>
        <button onClick={() => exportFile('csv')} className="btn-secondary flex items-center gap-2 text-sm">
          <FileText size={14} /> CSV
        </button>
        <button onClick={() => exportFile('xlsx')} className="btn-secondary flex items-center gap-2 text-sm">
          <FileSpreadsheet size={14} /> Excel
        </button>
        <button onClick={() => setShowSave((v) => !v)} className="btn-secondary flex items-center gap-2 text-sm">
          <Save size={14} /> Sauvegarder
        </button>
      </div>

      {showSave && (
        <div className="flex gap-2 items-end bg-gray-50 rounded-lg p-3">
          <div className="flex-1">
            <label className="label">Nom du rapport</label>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ex: Performance agents mois M" className="input-field mt-1 w-full text-sm" />
          </div>
          <button onClick={save} disabled={saving || !saveName.trim()}
            className="btn-primary text-sm flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} OK
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Result Table ─────────────────────────────────────────────────────────────

function ReportTable({ data, config }: { data: any[]; config: ReportConfig }) {
  if (!data || data.length === 0) return <p className="text-center text-gray-400 py-8 text-sm">Aucun résultat</p>;

  const isGrouped = config.groupBy === 'agent' || config.groupBy === 'campaign';
  const metricLabels = Object.fromEntries(ALL_METRICS.map((m) => [m.key, m.label]));

  if (isGrouped) {
    const rows = data as { agent?: any; campaign?: any; kpi: any }[];
    const keys = config.metrics.length > 0 ? config.metrics : Object.keys(rows[0]?.kpi ?? {}).filter((k) => typeof rows[0].kpi[k] === 'number');
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{config.groupBy === 'agent' ? 'Agent' : 'Campagne'}</th>
              {keys.map((k) => <th key={k} className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">{metricLabels[k] ?? k}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {r.agent ? `${r.agent.firstName} ${r.agent.lastName}` : r.campaign?.name ?? '—'}
                </td>
                {keys.map((k) => (
                  <td key={k} className="px-4 py-3 text-right text-gray-700">
                    {typeof r.kpi[k] === 'number' ? r.kpi[k].toFixed(1) : r.kpi[k] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Mode global (1 ligne)
  const row = data[0] ?? data;
  const entries = Object.entries(row).filter(([, v]) => typeof v === 'number');
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
      {entries.map(([k, v]) => (
        <div key={k} className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 font-medium">{metricLabels[k] ?? k}</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{typeof v === 'number' ? v.toFixed(1) : String(v)}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [result, setResult] = useState<any[] | null>(null);
  const [runConfig, setRunConfig] = useState<ReportConfig | null>(null);
  const [running, setRunning] = useState(false);
  const [showSaved, setShowSaved] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/users/agents/list').then((r) => setAgents(r.data.data ?? r.data)),
      api.get('/campaigns?limit=100').then((r) => setCampaigns(r.data.data ?? [])),
      api.get('/reporting').then((r) => setSavedReports(r.data.data ?? r.data ?? [])),
    ]).catch(() => {});
  }, []);

  const runReport = useCallback(async (config: ReportConfig) => {
    setRunning(true); setRunConfig(config);
    try {
      const res = await api.post('/reporting/run', config);
      const data = res.data.data ?? res.data;
      setResult(Array.isArray(data) ? data : [data]);
    } finally { setRunning(false); }
  }, []);

  const deleteSaved = async (id: string) => {
    await api.delete(`/reporting/${id}`);
    setSavedReports((p) => p.filter((r) => r.id !== id));
  };

  // Graphique comparatif agents
  const chartData = result && runConfig?.groupBy === 'agent'
    ? (result as any[]).map((r) => ({
        name: `${r.agent?.firstName ?? ''} ${r.agent?.lastName ?? ''}`.trim(),
        TTR: +((r.kpi?.ttr ?? 0).toFixed(1)),
        'HC%': +((r.kpi?.tauxHc ?? 0).toFixed(1)),
        RDV: r.kpi?.appointmentsSet ?? 0,
        Ventes: r.kpi?.sales ?? 0,
      }))
    : null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analyse personnalisée & exports</p>
        </div>
      </div>

      {/* Rapports sauvegardés */}
      {savedReports.length > 0 && (
        <div className="card overflow-hidden">
          <button onClick={() => setShowSaved((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <span className="flex items-center gap-2"><Download size={14} /> Rapports sauvegardés ({savedReports.length})</span>
            {showSaved ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showSaved && (
            <div className="divide-y divide-gray-100">
              {savedReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.description} · {new Date(r.updatedAt).toLocaleDateString('fr-FR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => runReport(r.config)}
                      className="text-xs btn-secondary flex items-center gap-1"><Play size={11} /> Relancer</button>
                    <button onClick={() => deleteSaved(r.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 rounded"><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Builder */}
      <ReportBuilder agents={agents} campaigns={campaigns} onRun={runReport} />

      {/* Résultats */}
      {running && (
        <div className="card p-12 text-center">
          <Loader2 size={24} className="animate-spin mx-auto text-primary-400" />
          <p className="text-sm text-gray-400 mt-2">Génération en cours…</p>
        </div>
      )}

      {!running && result && (
        <div className="space-y-4">
          {/* Graphique comparatif si groupBy agent */}
          {chartData && chartData.length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Comparaison agents</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="TTR" fill="#2563eb" name="TTR %" radius={[3,3,0,0]} />
                  <Bar dataKey="HC%" fill="#dc2626" name="Taux HC %" radius={[3,3,0,0]} />
                  <Bar dataKey="RDV" fill="#16a34a" name="RDV" radius={[3,3,0,0]} />
                  <Bar dataKey="Ventes" fill="#f59e0b" name="Ventes" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Résultats ({result.length} ligne{result.length !== 1 ? 's' : ''})</h3>
            </div>
            <ReportTable data={result} config={runConfig!} />
          </div>
        </div>
      )}
    </div>
  );
}
