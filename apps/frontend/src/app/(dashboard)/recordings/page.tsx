'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic, Search, Download, Play, Pause, SkipBack, SkipForward,
  Filter, Loader2, User, Calendar, Clock, Phone,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Recording {
  id: string; fileName: string; format: string;
  durationSec: number; callerNumber: string; calleeNumber: string;
  createdAt: string; url: string;
  agent?: { id: string; firstName: string; lastName: string };
  campaign?: { id: string; name: string };
  call: { id: string; direction: string; status: string; disposition?: string };
}

const QUALIF_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'À rappeler', WRONG_NUMBER: 'Faux numéro', VOICEMAIL: 'Répondeur',
  DNC: 'DNC', OTHER: 'Autre',
};

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function AudioPlayer({ recordingId, duration }: { recordingId: string; duration: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const streamUrl = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/recordings/${recordingId}/stream`;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else {
      if (!loaded) { audioRef.current.src = streamUrl; setLoaded(true); }
      audioRef.current.play(); setPlaying(true);
    }
  };

  const seek = (delta: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + delta));
  };

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <audio ref={audioRef}
        onTimeUpdate={() => setCurrent(Math.floor(audioRef.current?.currentTime ?? 0))}
        onEnded={() => setPlaying(false)} />

      <button onClick={() => seek(-10)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded"><SkipBack size={13} /></button>

      <button onClick={toggle}
        className="w-7 h-7 flex items-center justify-center bg-primary-600 text-white rounded-full hover:bg-primary-700 shrink-0">
        {playing ? <Pause size={12} /> : <Play size={12} />}
      </button>

      <button onClick={() => seek(10)}
        className="p-1 text-gray-400 hover:text-gray-600 rounded"><SkipForward size={13} /></button>

      <div className="flex-1 min-w-[80px]">
        <div className="h-1 bg-gray-200 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            if (!audioRef.current) return;
            const rect = (e.target as HTMLElement).getBoundingClientRect();
            const ratio = (e.clientX - rect.left) / rect.width;
            audioRef.current.currentTime = ratio * duration;
          }}>
          <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
          <span>{fmtDur(current)}</span>
          <span>{fmtDur(duration)}</span>
        </div>
      </div>
    </div>
  );
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch]       = useState('');
  const [phone, setPhone]         = useState('');
  const [agentId, setAgentId]     = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [dateFrom, setDateFrom]   = useState('');
  const [dateTo, setDateTo]       = useState('');
  const [minDur, setMinDur]       = useState('');
  const [maxDur, setMaxDur]       = useState('');

  const [agents, setAgents]       = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const LIMIT = 30;

  useEffect(() => {
    api.get('/users?role=AGENT&limit=100').then((r) => setAgents(r.data.data ?? [])).catch(() => {});
    api.get('/campaigns?limit=100').then((r) => setCampaigns(r.data.data ?? [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search)     params.set('search', search);
      if (phone)      params.set('phone', phone);
      if (agentId)    params.set('agentId', agentId);
      if (campaignId) params.set('campaignId', campaignId);
      if (dateFrom)   params.set('dateFrom', dateFrom);
      if (dateTo)     params.set('dateTo', dateTo);
      if (minDur)     params.set('minDuration', minDur);
      if (maxDur)     params.set('maxDuration', maxDur);
      const res = await api.get(`/recordings?${params}`);
      setRecordings(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } finally { setLoading(false); }
  }, [page, search, phone, agentId, campaignId, dateFrom, dateTo, minDur, maxDur]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = (rec: Recording) => {
    const a = document.createElement('a');
    a.href = `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/recordings/${rec.id}/download`;
    a.download = rec.fileName;
    a.click();
  };

  const reset = () => {
    setSearch(''); setPhone(''); setAgentId(''); setCampaignId('');
    setDateFrom(''); setDateTo(''); setMinDur(''); setMaxDur('');
    setPage(1);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enregistrements</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} enregistrement{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowFilters((v) => !v)}
          className={clsx('btn-secondary flex items-center gap-2 text-sm',
            showFilters && 'bg-primary-50 border-primary-300 text-primary-700')}>
          <Filter size={14} /> Filtres
        </button>
      </div>

      {/* Filtres */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Agent</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom agent…" className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+336…" className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Campagne</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
              className="input-field text-sm mt-1 w-full">
              <option value="">Toutes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Durée min (s)</label>
            <input type="number" value={minDur} onChange={(e) => setMinDur(e.target.value)}
              placeholder="0" className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Date début</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Date fin</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="input-field text-sm mt-1 w-full" />
          </div>
          <div className="flex items-end gap-2 col-span-2">
            <button onClick={() => { setPage(1); load(); }} className="btn-primary text-sm flex-1">
              Appliquer
            </button>
            <button onClick={reset} className="btn-secondary text-sm">Réinitialiser</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
        ) : recordings.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Mic size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun enregistrement</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Agent', 'De → Vers', 'Durée', 'Lecteur', 'Campagne', 'Format', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recordings.map((rec) => (
                <tr key={rec.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(rec.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                    <div className="text-gray-400 mt-0.5">
                      {new Date(rec.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {rec.agent ? (
                      <span className="flex items-center gap-1.5 text-sm font-medium text-gray-800">
                        <User size={13} className="text-gray-400" />
                        {rec.agent.firstName} {rec.agent.lastName}
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Phone size={11} /> {rec.callerNumber}
                    </div>
                    <div className="text-gray-400 mt-0.5">→ {rec.calleeNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs text-gray-600">
                      <Clock size={11} /> {fmtDur(rec.durationSec)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <AudioPlayer recordingId={rec.id} duration={rec.durationSec} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {rec.campaign?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {rec.format}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleDownload(rec)}
                      title="Télécharger"
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                      <Download size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page}/{totalPages} · {total.toLocaleString()} enregistrements</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs disabled:opacity-40">Préc.</button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      )}
    </div>
  );
}
