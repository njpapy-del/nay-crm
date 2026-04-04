'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Bell, Users, TrendingUp, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts';

interface AgentKpi {
  agent: { id: string; firstName: string; lastName: string; role: string };
  kpi: {
    totalCalls: number; answeredCalls: number; appointmentsSet: number;
    appointmentsValid: number; sales: number; revenue: number;
    ttr: number; tpr: number; tauxHc: number; tauxContact: number;
    avgCallDurationSec: number; productivite: number; tauAnnulation: number;
  };
}
interface AlertRule { id: string; name: string; metric: string; operator: string; threshold: number; isActive: boolean; lastFiredAt?: string; }

const METRIC_LABELS: Record<string, string> = {
  ttr: 'TTR %', tauxHc: 'HC %', tauAnnulation: 'Annulation %',
  avgCallDuration: 'Durée moy.', tauxContact: 'Contact %',
};
const OPERATOR_LABELS: Record<string, string> = { lt: '<', gt: '>', lte: '≤', gte: '≥' };

function fmtDur(sec: number) { const m = Math.floor(sec / 60); return `${m}m${String(Math.round(sec % 60)).padStart(2,'0')}s`; }

function RankTable({ agents, metric, label, higher = true }: {
  agents: AgentKpi[]; metric: keyof AgentKpi['kpi']; label: string; higher?: boolean;
}) {
  const sorted = [...agents].sort((a, b) => higher ? b.kpi[metric] - a.kpi[metric] : a.kpi[metric] - b.kpi[metric]);
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <TrendingUp size={14} className="text-primary-500" />
        <span className="text-sm font-semibold text-gray-700">{label}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {sorted.slice(0, 5).map((r, i) => {
          const val = r.kpi[metric];
          const formatted = metric === 'avgCallDurationSec' ? fmtDur(val as number)
            : metric === 'revenue' ? `${(val as number).toLocaleString('fr-FR')} €`
            : typeof val === 'number' ? val.toFixed(1) : String(val);
          return (
            <div key={r.agent.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={clsx('w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold shrink-0',
                i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600')}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.agent.firstName} {r.agent.lastName}</p>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatted}{['ttr','tauxHc','tauxContact','tauAnnulation'].includes(metric as string) ? '%' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function KpiPage() {
  const [period, setPeriod] = useState('month');
  const [agentKpis, setAgentKpis] = useState<AgentKpi[]>([]);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAlert, setNewAlert] = useState({ name: '', metric: 'ttr', operator: 'lt', threshold: 5 });
  const [savingAlert, setSavingAlert] = useState(false);
  const [showAlertForm, setShowAlertForm] = useState(false);

  const getRange = useCallback(() => {
    const to = new Date().toISOString().split('T')[0];
    if (period === 'week') { const d = new Date(); d.setDate(d.getDate() - 6); return { dateFrom: d.toISOString().split('T')[0], dateTo: to }; }
    if (period === 'month') { const d = new Date(); d.setDate(1); return { dateFrom: d.toISOString().split('T')[0], dateTo: to }; }
    const d = new Date(); d.setMonth(d.getMonth() - 3); d.setDate(1);
    return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { dateFrom, dateTo } = getRange();
      const p = `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const [agentsRes, tsRes, alertsRes] = await Promise.all([
        api.get(`/kpi/by-agent${p}`),
        api.get(`/kpi/timeseries${p}&granularity=day`),
        api.get('/kpi/alerts'),
      ]);
      setAgentKpis(agentsRes.data.data ?? agentsRes.data ?? []);
      setTimeSeries(tsRes.data.data ?? tsRes.data ?? []);
      setAlerts(alertsRes.data.data ?? alertsRes.data ?? []);
    } finally { setLoading(false); }
  }, [getRange]);

  useEffect(() => { load(); }, [load]);

  const createAlert = async () => {
    setSavingAlert(true);
    try { const res = await api.post('/kpi/alerts', newAlert); setAlerts((p) => [...p, res.data.data ?? res.data]); setShowAlertForm(false); }
    finally { setSavingAlert(false); }
  };

  const deleteAlert = async (id: string) => {
    await api.delete(`/kpi/alerts/${id}`); setAlerts((p) => p.filter((a) => a.id !== id));
  };

  // Radar data (top agents comparaison)
  const radarData = ['ttr','tauxContact','productivite','tpr'].map((metric) => {
    const entry: any = { metric: METRIC_LABELS[metric] ?? metric };
    agentKpis.slice(0, 4).forEach((a) => {
      entry[`${a.agent.firstName}`] = +((a.kpi as any)[metric] ?? 0).toFixed(1);
    });
    return entry;
  });

  const RADAR_COLORS = ['#2563eb','#16a34a','#f59e0b','#dc2626'];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">KPIs Call Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">Performance agents · Suivi indicateurs</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[{v:'week',l:'Semaine'},{v:'month',l:'Mois'},{v:'quarter',l:'Trimestre'}].map((o) => (
            <button key={o.v} onClick={() => setPeriod(o.v)}
              className={clsx('px-3 py-1.5 transition-colors', period === o.v ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      {/* Classements */}
      {agentKpis.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <RankTable agents={agentKpis} metric="ttr" label="Top TTR %" higher />
          <RankTable agents={agentKpis} metric="appointmentsSet" label="Top RDV pris" higher />
          <RankTable agents={agentKpis} metric="sales" label="Top Ventes" higher />
          <RankTable agents={agentKpis} metric="tauxHc" label="Taux HC élevé" higher={false} />
        </div>
      )}

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Barres comparaison KPIs agents */}
        {agentKpis.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">TTR & HC par agent</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={agentKpis.map((a) => ({
                name: a.agent.firstName,
                'TTR %': +a.kpi.ttr.toFixed(1),
                'HC %': +a.kpi.tauxHc.toFixed(1),
                'Contact %': +a.kpi.tauxContact.toFixed(1),
              }))} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" />
                <Tooltip formatter={(v: any) => [`${v}%`]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="TTR %" fill="#2563eb" radius={[3,3,0,0]} />
                <Bar dataKey="HC %" fill="#dc2626" radius={[3,3,0,0]} />
                <Bar dataKey="Contact %" fill="#16a34a" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar multi-agents */}
        {agentKpis.length > 1 && radarData.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Radar performance (top 4 agents)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                {agentKpis.slice(0, 4).map((a, i) => (
                  <Radar key={a.agent.id} name={a.agent.firstName} dataKey={a.agent.firstName}
                    stroke={RADAR_COLORS[i]} fill={RADAR_COLORS[i]} fillOpacity={0.15} />
                ))}
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Évolution TTR dans le temps */}
      {timeSeries.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Évolution TTR & Contact dans le temps</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={timeSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).split('T')[0]?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="ttr" stroke="#2563eb" name="TTR %" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tauxContact" stroke="#16a34a" name="Contact %" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tauxHc" stroke="#dc2626" name="HC %" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tableau détaillé agents */}
      {agentKpis.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
            <Users size={14} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-gray-700">Détail KPI par agent</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Agent','Appels','Décrochés','RDV','Val.','Ventes','CA €','TTR%','HC%','Contact%','Annul%','Moy.','Prod.'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {agentKpis.map(({ agent, kpi }) => (
                  <tr key={agent.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">{agent.firstName} {agent.lastName}</td>
                    <td className="px-3 py-2 text-center">{kpi.totalCalls}</td>
                    <td className="px-3 py-2 text-center">{kpi.answeredCalls}</td>
                    <td className="px-3 py-2 text-center">{kpi.appointmentsSet}</td>
                    <td className="px-3 py-2 text-center text-green-700">{kpi.appointmentsValid}</td>
                    <td className="px-3 py-2 text-center">{kpi.sales}</td>
                    <td className="px-3 py-2 text-center">{kpi.revenue.toLocaleString('fr-FR')}</td>
                    <td className="px-3 py-2 text-center font-medium text-blue-700">{kpi.ttr.toFixed(1)}%</td>
                    <td className={clsx('px-3 py-2 text-center font-medium', kpi.tauxHc > 30 ? 'text-red-600' : 'text-gray-700')}>{kpi.tauxHc.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center text-green-700">{kpi.tauxContact.toFixed(1)}%</td>
                    <td className={clsx('px-3 py-2 text-center', kpi.tauAnnulation > 20 ? 'text-red-500' : 'text-gray-700')}>{kpi.tauAnnulation.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center text-gray-500">{fmtDur(kpi.avgCallDurationSec)}</td>
                    <td className="px-3 py-2 text-center">{kpi.productivite.toFixed(1)}/h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Alertes */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2"><Bell size={14} /> Règles d'alerte</h3>
          <button onClick={() => setShowAlertForm((v) => !v)} className="btn-secondary text-sm flex items-center gap-1">
            <Plus size={13} /> Ajouter
          </button>
        </div>

        {showAlertForm && (
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="label">Nom</label>
              <input value={newAlert.name} onChange={(e) => setNewAlert((a) => ({ ...a, name: e.target.value }))}
                placeholder="Ex: TTR faible" className="input-field mt-1 w-full text-sm" />
            </div>
            <div>
              <label className="label">Métrique</label>
              <select value={newAlert.metric} onChange={(e) => setNewAlert((a) => ({ ...a, metric: e.target.value }))}
                className="input-field mt-1 w-full text-sm">
                {Object.entries(METRIC_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Opérateur</label>
              <select value={newAlert.operator} onChange={(e) => setNewAlert((a) => ({ ...a, operator: e.target.value }))}
                className="input-field mt-1 w-full text-sm">
                {Object.entries(OPERATOR_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Seuil</label>
              <div className="flex gap-2 mt-1">
                <input type="number" value={newAlert.threshold}
                  onChange={(e) => setNewAlert((a) => ({ ...a, threshold: +e.target.value }))}
                  className="input-field w-full text-sm" />
                <button onClick={createAlert} disabled={savingAlert || !newAlert.name}
                  className="btn-primary text-sm px-3 disabled:opacity-50">
                  {savingAlert ? <Loader2 size={12} className="animate-spin" /> : 'OK'}
                </button>
              </div>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <p className="text-sm text-gray-400">Aucune règle d'alerte configurée</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <Bell size={13} className={clsx(a.lastFiredAt ? 'text-orange-500' : 'text-gray-300')} />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{a.name}</p>
                    <p className="text-xs text-gray-400">
                      {METRIC_LABELS[a.metric] ?? a.metric} {OPERATOR_LABELS[a.operator]} {a.threshold}
                      {a.lastFiredAt && ` · déclenché ${new Date(a.lastFiredAt).toLocaleDateString('fr-FR')}`}
                    </p>
                  </div>
                </div>
                <button onClick={() => deleteAlert(a.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
