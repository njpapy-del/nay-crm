'use client';

import { useCallback, useEffect, useState } from 'react';
import { Phone, PhoneIncoming, PhoneOutgoing, BarChart2, Clock, X, ScrollText } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { ScriptPlayer } from '@/components/scripts/ScriptPlayer';

interface Call {
  id: string;
  direction: string;
  status: string;
  callerNumber: string;
  calleeNumber: string;
  duration?: number;
  startedAt: string;
  agent?: { firstName: string; lastName: string } | null;
  client?: { firstName: string; lastName: string; company?: string } | null;
  lead?: { id: string; campaignId: string } | null;
}

interface Script { id: string; title: string }

interface Stats {
  total: number;
  answered: number;
  answerRate: number;
  todayTotal: number;
  avgDuration: number;
}

const DIRECTION_ICON: Record<string, React.ElementType> = {
  INBOUND: PhoneIncoming, OUTBOUND: PhoneOutgoing, INTERNAL: Phone,
};
const DIRECTION_COLOR: Record<string, string> = {
  INBOUND: 'text-blue-500', OUTBOUND: 'text-green-500', INTERNAL: 'text-purple-500',
};
const STATUS_COLOR: Record<string, string> = {
  ANSWERED: 'text-green-600', RINGING: 'text-blue-500',
  BUSY: 'text-orange-500', NO_ANSWER: 'text-red-400',
  FAILED: 'text-red-600', CANCELLED: 'text-gray-400',
};
const STATUS_LABEL: Record<string, string> = {
  ANSWERED: 'Décroché', RINGING: 'Sonnerie', BUSY: 'Occupé',
  NO_ANSWER: 'Pas de réponse', FAILED: 'Échoué', CANCELLED: 'Annulé',
};

const FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'ANSWERED', label: 'Décroché' },
  { value: 'NO_ANSWER', label: 'Manqués' },
  { value: 'BUSY', label: 'Occupé' },
];

const fmtDuration = (s?: number) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<Call | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [activeScript, setActiveScript] = useState<Script | null>(null);

  async function openCallDrawer(call: Call) {
    setSelectedCall(call);
    setActiveScript(null);
    const campaignId = call.lead?.campaignId;
    const q = campaignId ? `?campaignId=${campaignId}` : '';
    const res = await api.get(`/scripts${q}`).catch(() => null);
    const list: Script[] = res?.data?.data ?? res?.data ?? [];
    setScripts(list);
    if (list.length === 1) setActiveScript(list[0]);
  }

  const fetchCalls = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const [callsRes, statsRes] = await Promise.all([
        api.get(`/calls?${params}`),
        api.get('/calls/stats'),
      ]);
      setCalls(callsRes.data.data);
      setTotal(callsRes.data.meta.total);
      setStats(statsRes.data);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchCalls(); }, [fetchCalls]);

  return (
    <div className="space-y-5 relative">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historique des appels</h1>
        <p className="text-gray-500 text-sm mt-0.5">{total} appels</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Aujourd'hui", value: stats.todayTotal, icon: Phone, color: 'text-primary-600' },
            { label: 'Total', value: stats.total, icon: BarChart2, color: 'text-gray-700' },
            { label: 'Taux décroché', value: `${stats.answerRate}%`, icon: PhoneIncoming, color: 'text-green-600' },
            { label: 'Durée moy.', value: fmtDuration(stats.avgDuration), icon: Clock, color: 'text-blue-600' },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={clsx('p-2 rounded-lg bg-gray-100', s.color)}>
                <s.icon size={18} />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {/* Filtres */}
        <div className="p-4 border-b border-gray-100 flex gap-2 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.value} onClick={() => setStatusFilter(f.value)}
              className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors',
                statusFilter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : calls.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun appel</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Direction', 'De', 'Vers', 'Agent', 'Client', 'Statut', 'Durée', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {calls.map((c) => {
                  const Icon = DIRECTION_ICON[c.direction] ?? Phone;
                  return (
                    <tr key={c.id} onClick={() => openCallDrawer(c)}
                      className="hover:bg-gray-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3">
                        <Icon size={16} className={DIRECTION_COLOR[c.direction] ?? 'text-gray-400'} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.callerNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{c.calleeNumber}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {c.agent ? `${c.agent.firstName} ${c.agent.lastName}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {c.client ? (
                          <div>
                            <div className="text-gray-900 font-medium">{c.client.firstName} {c.client.lastName}</div>
                            {c.client.company && <div className="text-xs text-gray-400">{c.client.company}</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className={clsx('px-4 py-3 text-xs font-medium', STATUS_COLOR[c.status] ?? 'text-gray-500')}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{fmtDuration(c.duration)}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(c.startedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Script drawer */}
      {selectedCall && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedCall(null)} />
          <div className="relative z-50 w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="font-semibold text-gray-900">Appel {selectedCall.direction === 'INBOUND' ? 'entrant' : 'sortant'}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selectedCall.callerNumber} → {selectedCall.calleeNumber}</p>
              </div>
              <button onClick={() => setSelectedCall(null)} className="p-2 rounded-lg hover:bg-gray-100"><X size={18} /></button>
            </div>

            {/* Script selector */}
            <div className="px-5 py-3 border-b border-gray-100 shrink-0">
              {scripts.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Aucun script associé à cette campagne</p>
              ) : (
                <div className="flex items-center gap-2">
                  <ScrollText size={15} className="text-gray-400 shrink-0" />
                  <select className="input flex-1 text-sm py-1.5"
                    value={activeScript?.id ?? ''}
                    onChange={e => setActiveScript(scripts.find(s => s.id === e.target.value) ?? null)}>
                    <option value="">— Choisir un script —</option>
                    {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* ScriptPlayer */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeScript ? (
                <ScriptPlayer
                  scriptId={activeScript.id}
                  callId={selectedCall.id}
                  campaignId={selectedCall.lead?.campaignId}
                />
              ) : (
                <div className="text-center py-12 text-gray-400">
                  <ScrollText size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Sélectionnez un script pour commencer</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
