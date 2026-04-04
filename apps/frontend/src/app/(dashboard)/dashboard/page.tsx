'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Phone, TrendingUp, Users, CalendarCheck,
  DollarSign, Activity, PhoneMissed, Loader2, RefreshCw,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

interface KpiResult {
  totalCalls: number; answeredCalls: number; missedCalls: number;
  avgCallDurationSec: number; appointmentsSet: number; appointmentsValid: number;
  sales: number; hcCount: number; revenue: number;
  ttr: number; tpr: number; tauxHc: number; tauxContact: number;
  tauxNonReponse: number; tauAnnulation: number; productivite: number;
}

interface DashboardData {
  calls: { total: number; answered: number; missed: number; avgDuration: number };
  qualifications: { qualification: string; count: number }[];
  sales: { count: number; revenue: number };
  appointments: { scheduled: number; confirmed: number; done: number; cancelled: number };
  activeAgents: number;
  activeCampaigns: number;
  recentCalls: any[];
}

const QUALIF_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'Rappel', WRONG_NUMBER: 'Faux n°', VOICEMAIL: 'Répondeur', DNC: 'DNC', OTHER: 'Autre',
};
const QUALIF_COLORS = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#9ca3af','#f59e0b'];
const PERIOD_OPTIONS = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
];

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}m${String(Math.round(sec % 60)).padStart(2,'0')}s`;
}
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

// ─── Composant KPI Card ───────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, sub, color = 'blue', pct = false }: {
  label: string; value: number | string; icon: React.ElementType;
  sub?: string; color?: string; pct?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600', cyan: 'bg-cyan-50 text-cyan-600',
  };
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colors[color] ?? colors.blue)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">
          {typeof value === 'number' && pct ? fmtPct(value) : value}
        </p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');
  const [kpi, setKpi] = useState<KpiResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    if (period === 'today') {
      return { dateFrom: to, dateTo: to };
    }
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
    }
    const d = new Date(now); d.setDate(1);
    return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
  }, [period]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { dateFrom, dateTo } = getDateRange();
      const params = `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const [kpiRes, dashRes, tsRes] = await Promise.all([
        api.get(`/kpi${params}`),
        api.get(`/analytics/dashboard${params}`),
        api.get(`/kpi/timeseries${params}&granularity=${period === 'today' ? 'day' : period === 'week' ? 'day' : 'day'}`),
      ]);
      setKpi(kpiRes.data.data?.kpi ?? kpiRes.data.kpi);
      setAlerts(kpiRes.data.data?.alerts ?? kpiRes.data.alerts ?? []);
      setDashboard(kpiRes.data.data?.dashboard ?? dashRes.data.data ?? dashRes.data);
      setTimeSeries(tsRes.data.data ?? tsRes.data ?? []);
    } finally { setLoading(false); setRefreshing(false); }
  }, [period, getDateRange]);

  useEffect(() => { load(); }, [load]);

  const pieData = (dashboard?.qualifications ?? [])
    .filter((q) => q.count > 0)
    .map((q) => ({ name: QUALIF_LABELS[q.qualification ?? ''] ?? q.qualification, value: q.count }));

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={28} className="animate-spin text-primary-400" />
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
          <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble · KPIs call center</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.value} onClick={() => setPeriod(o.value)}
                className={clsx('px-3 py-1.5 transition-colors',
                  period === o.value ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                {o.label}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={refreshing}
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw size={15} className={clsx(refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Alertes */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
          {alerts.map((a, i) => <p key={i} className="text-sm text-amber-800">{a}</p>)}
        </div>
      )}

      {/* KPI Cards row 1 — Appels */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total appels" value={kpi?.totalCalls ?? 0} icon={Phone} color="blue" sub={`${kpi?.answeredCalls ?? 0} décrochés`} />
        <KpiCard label="Taux contact" value={kpi?.tauxContact ?? 0} icon={Phone} color="green" pct sub={`${kpi?.missedCalls ?? 0} manqués`} />
        <KpiCard label="Non-réponse" value={kpi?.tauxNonReponse ?? 0} icon={PhoneMissed} color="red" pct />
        <KpiCard label="Durée moy. appel" value={fmtDur(kpi?.avgCallDurationSec ?? 0)} icon={Activity} color="purple" />
      </div>

      {/* KPI Cards row 2 — Performance */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="TTR (Transformation)" value={kpi?.ttr ?? 0} icon={TrendingUp} color="orange" pct sub="RDV validés / appels" />
        <KpiCard label="TPR (Production)" value={(kpi?.tpr ?? 0).toFixed(1)} icon={CalendarCheck} color="cyan" sub="RDV/jour travaillé" />
        <KpiCard label="Taux HC" value={kpi?.tauxHc ?? 0} icon={Users} color="red" pct sub={`${kpi?.hcCount ?? 0} hors cible`} />
        <KpiCard label="Taux annulation" value={kpi?.tauAnnulation ?? 0} icon={PhoneMissed} color="orange" pct />
      </div>

      {/* KPI Cards row 3 — CA */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="RDV pris" value={kpi?.appointmentsSet ?? 0} icon={CalendarCheck} color="blue" sub={`${kpi?.appointmentsValid ?? 0} validés`} />
        <KpiCard label="Ventes" value={kpi?.sales ?? 0} icon={TrendingUp} color="green" />
        <KpiCard label="Chiffre d'affaires" value={`${(kpi?.revenue ?? 0).toLocaleString('fr-FR')} €`} icon={DollarSign} color="green" />
        <KpiCard label="Productivité" value={`${(kpi?.productivite ?? 0).toFixed(1)}/h`} icon={Activity} color="purple" sub="appels/heure" />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Courbe évolution appels */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Évolution des appels</h3>
          {timeSeries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Aucune donnée historique</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.split('T')[0]?.slice(5) ?? v} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [v, '']} labelFormatter={(l) => String(l).split('T')[0]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="totalCalls" stroke="#2563eb" name="Appels" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="answeredCalls" stroke="#16a34a" name="Décrochés" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="appointmentsSet" stroke="#f59e0b" name="RDV" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Camembert qualifications */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition qualifications</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {pieData.map((_, i) => <Cell key={i} fill={QUALIF_COLORS[i % QUALIF_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Barres TTR/TPR */}
      {timeSeries.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">TTR & RDV par jour</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timeSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => String(v).split('T')[0]?.slice(5) ?? v} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="appointmentsSet" fill="#2563eb" name="RDV pris" radius={[3,3,0,0]} />
              <Bar dataKey="appointmentsValid" fill="#16a34a" name="RDV validés" radius={[3,3,0,0]} />
              <Bar dataKey="sales" fill="#f59e0b" name="Ventes" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Appels récents */}
      {dashboard?.recentCalls && dashboard.recentCalls.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Derniers appels journalisés</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>{['Date','Agent','Numéro','Durée','Qualification'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-gray-500 font-semibold uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboard.recentCalls.slice(0, 8).map((c: any) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-500">{new Date(c.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                  <td className="px-4 py-2 text-gray-700">{c.agent ? `${c.agent.firstName} ${c.agent.lastName}` : '—'}</td>
                  <td className="px-4 py-2 font-mono text-gray-600">{c.calleeNumber}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDur(c.durationSec)}</td>
                  <td className="px-4 py-2">
                    {c.qualification && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        {QUALIF_LABELS[c.qualification] ?? c.qualification}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
