'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Star, Users, ListChecks, Activity } from 'lucide-react';

interface KpiData {
  totalEvaluations: number;
  avgScore: number;
  qualifications: { total: number; ok: number; ko: number; hcc: number; hc: number };
  byAgent: { agentId: string; name: string; count: number; avg: number }[];
}

const QUALIF_COLORS: Record<string, string> = {
  ok: 'text-green-600', ko: 'text-red-500', hcc: 'text-orange-500', hc: 'text-yellow-600',
};

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function QualityDashboard() {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const from = new Date(Date.now() - +period * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    setLoading(true);
    api.get(`/quality/kpi?from=${from}&to=${to}`)
      .then(r => setKpi(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  const q = kpi?.qualifications;
  const total = q?.total || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Qualité</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des évaluations et qualifications RDV</p>
        </div>
        <div className="flex items-center gap-2">
          {['7', '30', '90'].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                period === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/quality/evaluations', label: 'Évaluations', icon: Star, color: 'bg-purple-500' },
          { href: '/quality/grids', label: 'Grilles', icon: ListChecks, color: 'bg-blue-500' },
          { href: '/quality/qualifications', label: 'Qualif. RDV', icon: CheckCircle, color: 'bg-green-500' },
          { href: '/quality/actions', label: 'Actions', icon: Activity, color: 'bg-orange-500' },
        ].map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
              <Icon size={16} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement...</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Évaluations" value={kpi?.totalEvaluations ?? 0} icon={Star} color="bg-purple-500" />
            <StatCard label="Score moyen" value={`${kpi?.avgScore ?? 0}%`} icon={TrendingUp} color="bg-blue-500" />
            <StatCard label="RDV qualifiés" value={q?.total ?? 0} icon={CheckCircle} color="bg-green-500" />
            <StatCard label="RDV KO + HCC" value={(q?.ko ?? 0) + (q?.hcc ?? 0)}
              sub={`${(((q?.ko ?? 0) + (q?.hcc ?? 0)) / total * 100).toFixed(1)}%`}
              icon={XCircle} color="bg-red-500" />
          </div>

          {/* Répartition qualifications */}
          {q && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Répartition des qualifications RDV</h2>
              <div className="grid grid-cols-4 gap-4 text-center">
                {(['ok', 'ko', 'hcc', 'hc'] as const).map(s => (
                  <div key={s} className="space-y-1">
                    <p className={clsx('text-3xl font-bold', QUALIF_COLORS[s])}>{q[s]}</p>
                    <p className="text-xs text-gray-500 uppercase font-medium">{s}</p>
                    <p className="text-xs text-gray-400">{(q[s] / total * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
              {/* Bar */}
              <div className="mt-4 flex h-3 rounded-full overflow-hidden">
                {[
                  { v: q.ok, c: 'bg-green-400' }, { v: q.ko, c: 'bg-red-400' },
                  { v: q.hcc, c: 'bg-orange-400' }, { v: q.hc, c: 'bg-yellow-400' },
                ].map(({ v, c }, i) => v > 0 ? (
                  <div key={i} className={c} style={{ width: `${(v / total) * 100}%` }} />
                ) : null)}
              </div>
            </div>
          )}

          {/* Par agent */}
          {kpi && kpi.byAgent.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users size={16} /> Score par agent
              </h2>
              <div className="space-y-3">
                {kpi.byAgent.sort((a, b) => b.avg - a.avg).map(a => (
                  <div key={a.agentId} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-medium shrink-0">
                      {a.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{a.name}</span>
                        <span className="text-sm font-bold text-gray-900 ml-2">{a.avg}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={clsx('h-full rounded-full transition-all', a.avg >= 70 ? 'bg-green-400' : a.avg >= 50 ? 'bg-orange-400' : 'bg-red-400')}
                          style={{ width: `${a.avg}%` }} />
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{a.count} eval.</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
