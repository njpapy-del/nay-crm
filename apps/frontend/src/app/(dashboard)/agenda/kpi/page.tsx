'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, CheckCircle, XCircle, Clock, BarChart2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentStat {
  agentId: string;
  count: number;
  agent: { id: string; firstName: string; lastName: string } | null;
}
interface CampaignStat {
  campaignId: string | null;
  count: number;
  campaign: { id: string; name: string } | null;
}
interface KpiData {
  total: number; scored: number; ok: number; ko: number; pending: number;
  tauxKo: number; tauxTransformation: number; convertedToSale: number;
  byAgent: AgentStat[];
  byCampaign: CampaignStat[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PERIODS = [
  { label: 'Aujourd\'hui', days: 0 },
  { label: '7 jours',     days: 7 },
  { label: '30 jours',    days: 30 },
  { label: '90 jours',    days: 90 },
];

function pct(n: number) { return `${n.toFixed(1)}%`; }

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: any; color: string; sub?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={clsx('p-2.5 rounded-xl', color)}>
        <Icon size={18} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  );
}

function BarRow({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pctVal = max > 0 ? (count / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-700 truncate max-w-[200px]">{label}</span>
        <span className="font-semibold text-gray-900 ml-2">{count}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={clsx('h-full rounded-full transition-all', color)} style={{ width: `${pctVal}%` }} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgendaKpiPage() {
  const [kpi,       setKpi]       = useState<KpiData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState(30);

  const fetchKpi = useCallback(async () => {
    setLoading(true);
    try {
      const from = period === 0
        ? new Date().toISOString().split('T')[0]
        : new Date(Date.now() - period * 86400000).toISOString().split('T')[0];
      const to = new Date().toISOString().split('T')[0];
      const res = await api.get(`/appointments/kpi?from=${from}&to=${to}`);
      setKpi(res.data?.data ?? res.data);
    } catch {} finally { setLoading(false); }
  }, [period]);

  useEffect(() => { fetchKpi(); }, [fetchKpi]);

  const maxAgent    = Math.max(1, ...(kpi?.byAgent    ?? []).map(a => a.count));
  const maxCampaign = Math.max(1, ...(kpi?.byCampaign ?? []).map(c => c.count));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agenda" className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Qualité RDV</h1>
          <p className="text-sm text-gray-500">Scoring, statuts et taux de transformation</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {PERIODS.map(p => (
              <button key={p.days} onClick={() => setPeriod(p.days)}
                className={clsx('px-3 py-1 rounded text-xs font-medium transition-colors',
                  period === p.days ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {p.label}
              </button>
            ))}
          </div>
          <button onClick={fetchKpi} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading && !kpi ? (
        <div className="py-16 text-center text-gray-400 text-sm">Chargement…</div>
      ) : kpi ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Total RDV"         value={kpi.total}            icon={BarChart2}   color="bg-primary-500" />
            <KpiCard label="RDV OK"            value={kpi.ok}               icon={CheckCircle} color="bg-green-500"   sub={`${pct(kpi.ok && kpi.scored ? kpi.ok / kpi.scored * 100 : 0)} des scorés`} />
            <KpiCard label="RDV KO"            value={kpi.ko}               icon={XCircle}     color="bg-red-500"     sub={`Taux KO : ${pct(kpi.tauxKo)}`} />
            <KpiCard label="En attente"        value={kpi.pending}          icon={Clock}       color="bg-yellow-500" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
            <KpiCard label="Convertis en vente" value={kpi.convertedToSale} icon={TrendingUp}  color="bg-emerald-500" sub={`TTR : ${pct(kpi.tauxTransformation)}`} />
            <KpiCard label="RDV scorés"         value={kpi.scored}          icon={BarChart2}   color="bg-blue-500"    sub={`${kpi.total > 0 ? pct(kpi.scored / kpi.total * 100) : '0%'} du total`} />
          </div>

          {/* Score bar OK/KO */}
          {kpi.scored > 0 && (
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Répartition OK / KO</h3>
              <div className="h-5 bg-gray-100 rounded-full overflow-hidden flex">
                <div className="bg-green-500 h-full transition-all" style={{ width: `${kpi.ok / kpi.scored * 100}%` }} title={`OK: ${kpi.ok}`} />
                <div className="bg-red-400 h-full transition-all" style={{ width: `${kpi.ko / kpi.scored * 100}%` }} title={`KO: ${kpi.ko}`} />
              </div>
              <div className="flex gap-4 mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />OK {kpi.ok}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />KO {kpi.ko}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />En attente {kpi.pending}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Par agent */}
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">RDV par agent</h3>
              {kpi.byAgent.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune donnée</p>
              ) : kpi.byAgent.sort((a, b) => b.count - a.count).map(a => (
                <BarRow
                  key={a.agentId}
                  label={a.agent ? `${a.agent.firstName} ${a.agent.lastName}` : a.agentId}
                  count={a.count}
                  max={maxAgent}
                  color="bg-primary-500"
                />
              ))}
            </div>

            {/* Par campagne */}
            <div className="card p-5 space-y-3">
              <h3 className="font-semibold text-gray-900">RDV par campagne</h3>
              {kpi.byCampaign.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune donnée</p>
              ) : kpi.byCampaign.sort((a, b) => b.count - a.count).map(c => (
                <BarRow
                  key={c.campaignId ?? 'none'}
                  label={c.campaign?.name ?? '(sans campagne)'}
                  count={c.count}
                  max={maxCampaign}
                  color="bg-blue-500"
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="py-16 text-center text-gray-400 text-sm">Aucune donnée disponible</div>
      )}
    </div>
  );
}
