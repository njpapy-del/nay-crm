'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, BarChart2, Clock,
  Download, Trash2, Play, Pause, X, Filter, Search,
  ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Agent { id: string; firstName: string; lastName: string; }
interface Campaign { id: string; name: string; }

interface CallLog {
  id: string;
  callerNumber: string;
  calleeNumber: string;
  qualification: string | null;
  durationSec: number | null;
  status: string;
  createdAt: string;
  notes: string | null;
  agent: Agent | null;
  campaign: Campaign | null;
  call: {
    id: string;
    direction: string;
    status: string;
    recording: { id: string; durationSec: number; format: string } | null;
    client: { id: string; firstName: string; lastName: string; phone: string; email: string } | null;
    lead:   { id: string; firstName: string; lastName: string; phone: string; email: string; company: string } | null;
  } | null;
}

interface Stats { total: number; answered: number; answerRate: number; todayTotal: number; avgDuration: number; }

// ─── Constantes ───────────────────────────────────────────────────────────────

const QUALIF_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'À rappeler', WRONG_NUMBER: 'Faux numéro',
  VOICEMAIL: 'Répondeur', DNC: 'DNC', OTHER: 'Autre',
  NO_ANSWER: 'Pas de réponse', REFUSED: 'Refus', HC: 'Hors cible',
};
const QUALIF_COLORS: Record<string, string> = {
  SALE: 'bg-green-100 text-green-700', APPOINTMENT: 'bg-primary-100 text-primary-700',
  NOT_INTERESTED: 'bg-red-100 text-red-600', REFUSED: 'bg-red-100 text-red-600',
  CALLBACK: 'bg-yellow-100 text-yellow-700', VOICEMAIL: 'bg-gray-100 text-gray-600',
  DNC: 'bg-red-200 text-red-800', NO_ANSWER: 'bg-orange-100 text-orange-700',
  HC: 'bg-purple-100 text-purple-700', OTHER: 'bg-gray-100 text-gray-500',
};

const DIR_ICON: Record<string, React.ElementType> = {
  INBOUND: PhoneIncoming, OUTBOUND: PhoneOutgoing, INTERNAL: Phone,
};
const DIR_COLOR: Record<string, string> = {
  INBOUND: 'text-blue-500', OUTBOUND: 'text-green-500', INTERNAL: 'text-purple-500',
};

const fmt = (s?: number | null) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ─── Mini audio player ────────────────────────────────────────────────────────

function AudioPlayer({ recordingId, onClose }: { recordingId: string; onClose: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [loading,   setLoading]   = useState(true);

  const src = `/api/v1/recordings/${recordingId}/stream`;

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
  };

  return (
    <div className="flex items-center gap-3 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-lg min-w-72">
      {loading && <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => { setDuration((e.target as HTMLAudioElement).duration); setLoading(false); }}
        onTimeUpdate={(e) => { const a = e.target as HTMLAudioElement; setProgress(a.currentTime / (a.duration || 1) * 100); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      {!loading && (
        <button onClick={toggle} className="shrink-0 w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center">
          {playing ? <Pause size={13} /> : <Play size={13} />}
        </button>
      )}
      <div className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer" onClick={seek}>
        <div className="h-1.5 bg-primary-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <span className="text-xs text-gray-400 shrink-0 font-mono">{fmt(duration)}</span>
      <button onClick={onClose} className="text-gray-400 hover:text-white shrink-0">
        <X size={14} />
      </button>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function CallsHistoryPage() {
  const { user } = useAuthStore();
  const role    = user?.role ?? 'AGENT';
  const isManager  = role === 'ADMIN' || role === 'MANAGER';
  const isQuality  = role === 'QUALITY' || role === 'QUALITY_SUPERVISOR';
  const canDelete  = role === 'ADMIN' || role === 'MANAGER';
  const canDownload = role === 'ADMIN' || role === 'MANAGER';
  const canListen  = true; // tous les rôles

  const [logs,       setLogs]       = useState<CallLog[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [agents,     setAgents]     = useState<Agent[]>([]);
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [playingId,  setPlayingId]  = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState<string | null>(null);

  // Filtres
  const [search,     setSearch]     = useState('');
  const [agentId,    setAgentId]    = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [qualif,     setQualif]     = useState('');
  const [direction,  setDirection]  = useState('');
  const [dateFrom,   setDateFrom]   = useState('');
  const [dateTo,     setDateTo]     = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const LIMIT = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)     p.set('search',     search);
      if (agentId)    p.set('agentId',    agentId);
      if (campaignId) p.set('campaignId', campaignId);
      if (qualif)     p.set('qualification', qualif);
      if (dateFrom)   p.set('dateFrom',   dateFrom);
      if (dateTo)     p.set('dateTo',     dateTo);
      const res = await api.get(`/call-logs?${p}`);
      const d = res.data;
      setLogs(d.data ?? []);
      setTotal(d.total ?? 0);
    } catch (e: any) {
      console.error('[call-logs]', e?.message);
    } finally {
      setLoading(false);
    }
  }, [page, search, agentId, campaignId, qualif, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    if (!isManager && !isQuality) return;
    Promise.allSettled([
      api.get('/users/agents/list'),
      api.get('/campaigns?status=ACTIVE&limit=100'),
    ]).then(([aRes, cRes]) => {
      if (aRes.status === 'fulfilled') setAgents(aRes.value.data?.data ?? []);
      if (cRes.status === 'fulfilled') {
        const d = cRes.value.data?.data;
        setCampaigns(Array.isArray(d) ? d : d?.data ?? []);
      }
    });
  }, [isManager, isQuality]);

  const deleteLog = async (id: string) => {
    if (!confirm('Supprimer cet appel ?')) return;
    setDeleting(id);
    try {
      await api.delete(`/call-logs/${id}`);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      setTotal((t) => t - 1);
    } finally { setDeleting(null); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const getContact = (log: CallLog) => log.call?.lead ?? log.call?.client ?? null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historique des appels</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total.toLocaleString('fr-FR')} appel{total > 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher agent, client, numéro…"
              className="input-field pl-9 text-sm w-64"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={clsx('flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
              showFilters ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50')}>
            <Filter size={14} />
            Filtres
            {(agentId || campaignId || qualif || direction || dateFrom || dateTo) && (
              <span className="w-2 h-2 rounded-full bg-primary-500 ml-0.5" />
            )}
          </button>
        </div>
      </div>

      {/* Filtres avancés */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {(isManager || isQuality) && (
            <div>
              <label className="label text-xs">Agent</label>
              <select value={agentId} onChange={(e) => { setAgentId(e.target.value); setPage(1); }} className="input-field text-xs mt-1">
                <option value="">Tous</option>
                {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
              </select>
            </div>
          )}
          {(isManager || isQuality) && (
            <div>
              <label className="label text-xs">Campagne</label>
              <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setPage(1); }} className="input-field text-xs mt-1">
                <option value="">Toutes</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label text-xs">Qualification</label>
            <select value={qualif} onChange={(e) => { setQualif(e.target.value); setPage(1); }} className="input-field text-xs mt-1">
              <option value="">Toutes</option>
              {Object.entries(QUALIF_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Sens</label>
            <select value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} className="input-field text-xs mt-1">
              <option value="">Tous</option>
              <option value="INBOUND">Entrant</option>
              <option value="OUTBOUND">Sortant</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Du</label>
            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="input-field text-xs mt-1" />
          </div>
          <div>
            <label className="label text-xs">Au</label>
            <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="input-field text-xs mt-1" />
          </div>
          <div className="col-span-full flex justify-end">
            <button onClick={() => { setAgentId(''); setCampaignId(''); setQualif(''); setDirection(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="text-xs text-gray-500 hover:text-red-500 underline">
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {/* Player flottant */}
      {playingId && (
        <div className="sticky top-4 z-30 flex justify-center">
          <AudioPlayer recordingId={playingId} onClose={() => setPlayingId(null)} />
        </div>
      )}

      {/* Tableau */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">
            <Loader2 size={24} className="animate-spin mx-auto mb-2" />
            Chargement…
          </div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            <Phone size={36} className="mx-auto mb-3 opacity-20" />
            <p>Aucun appel trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    'Type', 'Client', 'Téléphone', 'Qualification',
                    ...(isManager || isQuality ? ['Agent'] : []),
                    ...(isManager || isQuality ? ['Campagne'] : []),
                    'Durée', 'Date', 'Actions',
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const contact = getContact(log);
                  const dir     = log.call?.direction ?? 'OUTBOUND';
                  const Icon    = DIR_ICON[dir] ?? Phone;
                  const recId   = log.call?.recording?.id;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      {/* Type d'appel */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon size={15} className={DIR_COLOR[dir] ?? 'text-gray-400'} />
                          <span className="text-xs text-gray-500">{dir === 'INBOUND' ? 'Entrant' : dir === 'OUTBOUND' ? 'Sortant' : 'Interne'}</span>
                        </div>
                      </td>

                      {/* Client */}
                      <td className="px-3 py-3">
                        {contact ? (
                          <div>
                            <p className="font-medium text-gray-900">{contact.firstName} {contact.lastName}</p>
                            {('company' in contact) && (contact as any).company && (
                              <p className="text-xs text-gray-400">{(contact as any).company}</p>
                            )}
                          </div>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>

                      {/* Téléphone */}
                      <td className="px-3 py-3 font-mono text-xs text-gray-600">
                        {contact?.phone ?? log.callerNumber ?? '—'}
                      </td>

                      {/* Qualification */}
                      <td className="px-3 py-3">
                        {log.qualification ? (
                          <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full', QUALIF_COLORS[log.qualification] ?? 'bg-gray-100 text-gray-600')}>
                            {QUALIF_LABELS[log.qualification] ?? log.qualification}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Agent (manager/qualité) */}
                      {(isManager || isQuality) && (
                        <td className="px-3 py-3 text-gray-700 text-xs">
                          {log.agent ? `${log.agent.firstName} ${log.agent.lastName}` : '—'}
                        </td>
                      )}

                      {/* Campagne (manager/qualité) */}
                      {(isManager || isQuality) && (
                        <td className="px-3 py-3 text-xs text-gray-500">{log.campaign?.name ?? '—'}</td>
                      )}

                      {/* Durée */}
                      <td className="px-3 py-3 text-gray-500 text-xs">{fmt(log.durationSec)}</td>

                      {/* Date */}
                      <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {/* Écouter */}
                          {canListen && recId && (
                            <button
                              onClick={() => setPlayingId(playingId === recId ? null : recId)}
                              title="Écouter"
                              className={clsx('p-1.5 rounded-lg transition-colors',
                                playingId === recId
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'text-gray-400 hover:text-primary-600 hover:bg-primary-50')}>
                              {playingId === recId ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                          )}

                          {/* Télécharger */}
                          {canDownload && recId && (
                            <a
                              href={`/api/v1/recordings/${recId}/download`}
                              download
                              title="Télécharger"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <Download size={13} />
                            </a>
                          )}

                          {/* Supprimer */}
                          {canDelete && (
                            <button
                              onClick={() => deleteLog(log.id)}
                              disabled={deleting === log.id}
                              title="Supprimer"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40">
                              {deleting === log.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Page {page} / {totalPages} — {total.toLocaleString('fr-FR')} résultats
            </p>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
