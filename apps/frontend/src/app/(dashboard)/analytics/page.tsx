'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';

const QUALIF_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Non int.', CALLBACK: 'Rappel',
  WRONG_NUMBER: 'Faux n°', VOICEMAIL: 'Répondeur', DNC: 'DNC', OTHER: 'Autre', null: 'Non qualifié',
};
const COLORS = ['#2563eb','#16a34a','#f59e0b','#dc2626','#7c3aed','#0891b2','#9ca3af','#f97316'];
const PERIOD_OPTIONS = [{v:'week',l:'7 jours'},{v:'month',l:'30 jours'},{v:'quarter',l:'90 jours'}];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('month');
  const [dashboard, setDashboard] = useState<any>(null);
  const [qualifData, setQualifData] = useState<any[]>([]);
  const [hourData, setHourData] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [realtime, setRealtime] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getDates = useCallback(() => {
    const to = new Date().toISOString().split('T')[0];
    const d = new Date();
    if (period === 'week') d.setDate(d.getDate() - 6);
    else if (period === 'month') d.setDate(d.getDate() - 29);
    else d.setDate(d.getDate() - 89);
    return { dateFrom: d.toISOString().split('T')[0], dateTo: to };
  }, [period]);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const { dateFrom, dateTo } = getDates();
      const p = `?dateFrom=${dateFrom}&dateTo=${dateTo}`;
      const [dashRes, qualifRes, hourRes, campRes, revRes, rtRes] = await Promise.allSettled([
        api.get(`/analytics/dashboard${p}`),
        api.get(`/analytics/qualifications${p}`),
        api.get(`/analytics/calls-by-hour${p}`),
        api.get(`/analytics/by-campaign${p}`),
        api.get(`/analytics/revenue${p}`),
        api.get('/analytics/realtime'),
      ]);
      const val = (r: PromiseSettledResult<any>) => r.status === 'fulfilled' ? r.value : null;
      const dashD  = val(dashRes);
      const qualifD = val(qualifRes);
      const hourD  = val(hourRes);
      const campD  = val(campRes);
      const revD   = val(revRes);
      const rtD    = val(rtRes);
      if (dashD)  setDashboard(dashD.data.data ?? dashD.data);
      if (qualifD) setQualifData((qualifD.data.data ?? qualifD.data ?? []).map((q: any) => ({ name: QUALIF_LABELS[q.qualification] ?? q.qualification, value: q.count })));
      if (hourD)  setHourData(hourD.data.data ?? hourD.data ?? []);
      if (campD)  setCampaignData(campD.data.data ?? campD.data ?? []);
      if (revD)   setRevenueData(revD.data.data ?? revD.data ?? []);
      if (rtD)    setRealtime(rtD.data.data ?? rtD.data);
    } finally { setLoading(false); setRefreshing(false); }
  }, [getDates]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  const rt = realtime;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytiques</h1>
          <p className="text-sm text-gray-500 mt-0.5">Analyse détaillée · Campagnes · Horaires</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {PERIOD_OPTIONS.map((o) => (
              <button key={o.v} onClick={() => setPeriod(o.v)}
                className={clsx('px-3 py-1.5 transition-colors', period === o.v ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50')}>
                {o.l}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={refreshing} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
            <RefreshCw size={15} className={clsx(refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Temps réel */}
      {rt && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Appels actifs', val: rt.activeCalls, color: 'bg-green-50 text-green-700' },
            { label: 'Agents connectés', val: rt.agentSessions?.length ?? 0, color: 'bg-blue-50 text-blue-700' },
            { label: "Appels aujourd'hui", val: rt.todayCalls, color: 'bg-purple-50 text-purple-700' },
          ].map((s) => (
            <div key={s.label} className={clsx('card p-4 text-center rounded-xl', s.color)}>
              <p className="text-2xl font-bold">{s.val}</p>
              <p className="text-xs font-medium mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Qualifications camembert */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Répartition qualifications</h3>
          {qualifData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Aucune donnée</div>
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <PieChart>
                <Pie data={qualifData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {qualifData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Distribution horaire */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Appels par heure</h3>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={hourData.filter((h) => h.hour >= 8 && h.hour <= 20)} margin={{ top: 4, right: 8, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{ fontSize: 11 }} tickFormatter={(h) => `${h}h`} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip labelFormatter={(h) => `${h}h00`} />
              <Bar dataKey="count" fill="#2563eb" name="Appels" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Évolution CA */}
      {revenueData.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Évolution chiffre d'affaires</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={revenueData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v?.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}€`} />
              <Tooltip formatter={(v: any) => [`${v.toLocaleString('fr-FR')} €`, 'CA']} />
              <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} name="CA €" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Performance campagnes */}
      {campaignData.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-700">Performance par campagne</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Campagne','Statut','Leads','Appels','Ventes','RDV','TTR %'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {campaignData.map((c: any) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        c.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center">{c._count?.leads ?? 0}</td>
                    <td className="px-4 py-2 text-center">{c._count?.callLogs ?? 0}</td>
                    <td className="px-4 py-2 text-center text-green-700 font-medium">{c.sales}</td>
                    <td className="px-4 py-2 text-center">{c.appointments}</td>
                    <td className={clsx('px-4 py-2 text-center font-bold', c.ttr >= 10 ? 'text-green-600' : c.ttr >= 5 ? 'text-yellow-600' : 'text-red-500')}>
                      {c.ttr}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
