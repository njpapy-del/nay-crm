'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  { value: 'week',  label: 'Cette semaine' },
  { value: 'month', label: 'Ce mois' },
];

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  return `${m}m${String(Math.round(sec % 60)).padStart(2,'0')}s`;
}
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimatedNumber({ value, format }: { value: number; format?: (v: number) => string }) {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>();

  useEffect(() => {
    const start = display;
    const end = value;
    const duration = 900;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out quart
      const ease = 1 - Math.pow(1 - progress, 4);
      setDisplay(start + (end - start) * ease);
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };

    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [value]);

  const formatted = format ? format(display) : Math.round(display).toLocaleString('fr-FR');
  return <span>{formatted}</span>;
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, sub, color = 'blue', pct = false, index = 0, format }: {
  label: string; value: number | string; icon: React.ElementType;
  sub?: string; color?: string; pct?: boolean; index?: number; format?: (v: number) => string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), index * 80);
    return () => clearTimeout(t);
  }, [index]);

  const colors: Record<string, { bg: string; text: string; glow: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-600',   glow: '#2563eb' },
    green:  { bg: 'bg-green-50',  text: 'text-green-600',  glow: '#16a34a' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', glow: '#f97316' },
    red:    { bg: 'bg-red-50',    text: 'text-red-600',    glow: '#dc2626' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', glow: '#7c3aed' },
    cyan:   { bg: 'bg-cyan-50',   text: 'text-cyan-600',   glow: '#0891b2' },
  };
  const c = colors[color] ?? colors.blue;

  return (
    <div className={clsx(
      'db-kpi-card card p-4 flex items-center gap-4 transition-all duration-500',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
    )}>
      <div className={clsx('w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 hover:scale-110', c.bg, c.text)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 font-medium truncate">{label}</p>
        <p className="text-xl font-bold text-gray-900 truncate">
          {typeof value === 'number'
            ? <AnimatedNumber value={value} format={format ?? (pct ? (v) => fmtPct(v) : undefined)} />
            : value}
        </p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
      {/* Subtle progress bar at bottom */}
      <div className="db-kpi-bar" style={{ background: c.glow }} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [period, setPeriod] = useState('month');
  const [kpi, setKpi] = useState<KpiResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [timeSeries, setTimeSeries] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chartsVisible, setChartsVisible] = useState(false);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    if (period === 'today') return { dateFrom: to, dateTo: to };
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 6);
      return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
    }
    const d = new Date(now); d.setDate(1);
    return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
  }, [period]);

  const load = useCallback(async () => {
    setRefreshing(true);
    setChartsVisible(false);
    try {
      const { dateFrom, dateTo } = getDateRange();
      const params = `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const [kpiRes, dashRes, tsRes] = await Promise.allSettled([
        api.get(`/kpi${params}`),
        api.get(`/analytics/dashboard${params}`),
        api.get(`/kpi/timeseries${params}&granularity=day`),
      ]);
      const kpi = kpiRes.status === 'fulfilled' ? kpiRes.value : null;
      const dash = dashRes.status === 'fulfilled' ? dashRes.value : null;
      const ts = tsRes.status === 'fulfilled' ? tsRes.value : null;
      setKpi(kpi?.data.data?.kpi ?? kpi?.data.kpi ?? null);
      setAlerts(kpi?.data.data?.alerts ?? kpi?.data.alerts ?? []);
      setDashboard(kpi?.data.data?.dashboard ?? dash?.data.data ?? dash?.data ?? null);
      setTimeSeries(ts?.data.data ?? ts?.data ?? []);
      setTimeout(() => setChartsVisible(true), 200);
    } finally { setLoading(false); setRefreshing(false); }
  }, [period, getDateRange]);

  useEffect(() => { load(); }, [load]);

  const pieData = (dashboard?.qualifications ?? [])
    .filter((q) => q.count > 0)
    .map((q) => ({ name: QUALIF_LABELS[q.qualification ?? ''] ?? q.qualification, value: q.count }));

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <div className="db-spinner" />
      <p className="text-sm text-gray-400 animate-pulse">Chargement du tableau de bord…</p>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 db-header">
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
            className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors">
            <RefreshCw size={15} className={clsx(refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1 db-alert-enter">
          {alerts.map((a, i) => <p key={i} className="text-sm text-amber-800">{a}</p>)}
        </div>
      )}

      {/* ── KPI Row 1 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard index={0} label="Total appels"    value={kpi?.totalCalls ?? 0}      icon={Phone}        color="blue"   sub={`${kpi?.answeredCalls ?? 0} décrochés`} />
        <KpiCard index={1} label="Taux contact"    value={kpi?.tauxContact ?? 0}     icon={Phone}        color="green"  pct sub={`${kpi?.missedCalls ?? 0} manqués`} />
        <KpiCard index={2} label="Non-réponse"     value={kpi?.tauxNonReponse ?? 0}  icon={PhoneMissed}  color="red"    pct />
        <KpiCard index={3} label="Durée moy."      value={fmtDur(kpi?.avgCallDurationSec ?? 0)} icon={Activity} color="purple" />
      </div>

      {/* ── KPI Row 2 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard index={4} label="TTR (Transform.)"  value={kpi?.ttr ?? 0}                     icon={TrendingUp}   color="orange" pct sub="RDV validés / appels" />
        <KpiCard index={5} label="TPR (Production)"  value={parseFloat((kpi?.tpr ?? 0).toFixed(1))} icon={CalendarCheck} color="cyan" sub="RDV/jour travaillé" />
        <KpiCard index={6} label="Taux HC"           value={kpi?.tauxHc ?? 0}                  icon={Users}        color="red"    pct sub={`${kpi?.hcCount ?? 0} hors cible`} />
        <KpiCard index={7} label="Taux annulation"   value={kpi?.tauAnnulation ?? 0}           icon={PhoneMissed}  color="orange" pct />
      </div>

      {/* ── KPI Row 3 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard index={8}  label="RDV pris"          value={kpi?.appointmentsSet ?? 0}  icon={CalendarCheck} color="blue"   sub={`${kpi?.appointmentsValid ?? 0} validés`} />
        <KpiCard index={9}  label="Ventes"            value={kpi?.sales ?? 0}            icon={TrendingUp}    color="green" />
        <KpiCard index={10} label="Chiffre d'affaires" value={kpi?.revenue ?? 0}         icon={DollarSign}    color="green"
          format={(v) => `${Math.round(v).toLocaleString('fr-FR')} €`} />
        <KpiCard index={11} label="Productivité"      value={parseFloat((kpi?.productivite ?? 0).toFixed(1))} icon={Activity} color="purple" sub="appels/heure" />
      </div>

      {/* ── Charts ── */}
      <div className={clsx('grid grid-cols-1 lg:grid-cols-3 gap-4 transition-all duration-700', chartsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}>

        {/* Line chart */}
        <div className="lg:col-span-2 card p-5 db-chart-card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Évolution des appels</h3>
          {timeSeries.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Aucune donnée historique</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeries} margin={{ top:4, right:8, left:-20, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="date" tick={{ fontSize:11 }} tickFormatter={(v) => v?.split('T')[0]?.slice(5) ?? v} />
                <YAxis tick={{ fontSize:11 }} />
                <Tooltip formatter={(v:any) => [v,'']} labelFormatter={(l) => String(l).split('T')[0]} contentStyle={{ borderRadius:8, border:'1px solid #e5e7eb', boxShadow:'0 4px 12px rgba(0,0,0,.08)' }} />
                <Legend wrapperStyle={{ fontSize:11 }} />
                <Line type="monotone" dataKey="totalCalls"      stroke="#2563eb" name="Appels"    strokeWidth={2} dot={false} animationDuration={1200} />
                <Line type="monotone" dataKey="answeredCalls"   stroke="#16a34a" name="Décrochés" strokeWidth={2} dot={false} animationDuration={1400} />
                <Line type="monotone" dataKey="appointmentsSet" stroke="#f59e0b" name="RDV"       strokeWidth={2} dot={false} animationDuration={1600} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart */}
        <div className="card p-5 db-chart-card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition qualifications</h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10} animationBegin={0} animationDuration={1000}>
                  {pieData.map((_, i) => <Cell key={i} fill={QUALIF_COLORS[i % QUALIF_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e5e7eb' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Bar chart ── */}
      {timeSeries.length > 0 && (
        <div className={clsx('card p-5 db-chart-card transition-all duration-700 delay-200', chartsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}>
          <h3 className="text-sm font-semibold text-gray-700 mb-4">TTR & RDV par jour</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timeSeries} margin={{ top:4, right:8, left:-20, bottom:0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize:11 }} tickFormatter={(v) => String(v).split('T')[0]?.slice(5) ?? v} />
              <YAxis tick={{ fontSize:11 }} />
              <Tooltip contentStyle={{ borderRadius:8, border:'1px solid #e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize:11 }} />
              <Bar dataKey="appointmentsSet"   fill="#2563eb" name="RDV pris"    radius={[4,4,0,0]} animationDuration={1000} />
              <Bar dataKey="appointmentsValid" fill="#16a34a" name="RDV validés" radius={[4,4,0,0]} animationDuration={1200} />
              <Bar dataKey="sales"             fill="#f59e0b" name="Ventes"      radius={[4,4,0,0]} animationDuration={1400} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Recent calls ── */}
      {dashboard?.recentCalls && dashboard.recentCalls.length > 0 && (
        <div className={clsx('card overflow-hidden db-chart-card transition-all duration-700 delay-300', chartsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6')}>
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Derniers appels journalisés</h3>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50">
              <tr>{['Date','Agent','Numéro','Durée','Qualification'].map((h) => (
                <th key={h} className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {dashboard.recentCalls.slice(0, 8).map((c: any, i: number) => (
                <tr key={c.id} className="hover:bg-primary-50 transition-colors db-row" style={{ animationDelay: `${i * 40}ms` }}>
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

      {/* ── Styles ── */}
      <style jsx global>{`
        /* Spinner */
        .db-spinner {
          width: 40px; height: 40px;
          border: 3px solid #e5e7eb;
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: db-spin 0.8s linear infinite;
        }
        @keyframes db-spin { to { transform: rotate(360deg); } }

        /* Header fade */
        .db-header { animation: db-fade-down 0.5s ease both; }
        @keyframes db-fade-down {
          from { opacity:0; transform:translateY(-12px); }
          to   { opacity:1; transform:translateY(0); }
        }

        /* Alert */
        .db-alert-enter { animation: db-fade-in 0.4s ease both; }
        @keyframes db-fade-in { from { opacity:0; } to { opacity:1; } }

        /* KPI card hover glow */
        .db-kpi-card {
          position: relative;
          overflow: hidden;
          cursor: default;
        }
        .db-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.10);
        }
        .db-kpi-bar {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2px;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .db-kpi-card:hover .db-kpi-bar { opacity: 0.6; }

        /* Chart card */
        .db-chart-card {
          transition: box-shadow 0.2s;
        }
        .db-chart-card:hover {
          box-shadow: 0 8px 32px rgba(0,0,0,0.09);
        }

        /* Table rows */
        .db-row {
          animation: db-row-in 0.35s ease both;
        }
        @keyframes db-row-in {
          from { opacity:0; transform:translateX(-8px); }
          to   { opacity:1; transform:translateX(0); }
        }
      `}</style>
    </div>
  );
}
