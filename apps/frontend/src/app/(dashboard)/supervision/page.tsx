'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Headphones, Mic, Users, PhoneCall, Pause, Wifi, WifiOff,
  StopCircle, BarChart2, RefreshCw, Loader2, Eye, Volume2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentSnapshot {
  agentId: string;
  name: string;
  extension: string;
  availability: string;
  currentCallId: string | null;
  callsToday: number;
  avgDuration: number;
  campaignId?: string | null;
}

interface SupervisorSnapshot {
  agents: AgentSnapshot[];
  today: {
    totalCalls: number;
    answered: number;
    answerRate: number;
    avgDuration: number;
    sales: number;
  };
  dialer: { campaignId: string; mode: string; active: boolean }[];
  timestamp: string;
}

interface SpySession {
  supervisorId: string;
  targetExtension: string;
  mode: 'listen' | 'whisper' | 'barge';
  startedAt: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const AVAIL_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  AVAILABLE: { label: 'Disponible',  color: 'bg-green-50 border-green-200',  dot: 'bg-green-400' },
  IN_CALL:   { label: 'En appel',    color: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500' },
  RINGING:   { label: 'Sonnerie',    color: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-400 animate-pulse' },
  WRAP_UP:   { label: 'Post-appel',  color: 'bg-yellow-50 border-yellow-200', dot: 'bg-yellow-400' },
  PAUSED:    { label: 'En pause',    color: 'bg-orange-50 border-orange-200', dot: 'bg-orange-400' },
  OFFLINE:   { label: 'Hors ligne',  color: 'bg-gray-50 border-gray-200',   dot: 'bg-gray-300' },
};

const fmt = (s?: number) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent, spySession, supervisorExtension,
  onSpy, onStopSpy, onSwitchMode,
}: {
  agent: AgentSnapshot;
  spySession: SpySession | null;
  supervisorExtension: string;
  onSpy: (ext: string, mode: 'listen' | 'whisper' | 'barge') => void;
  onStopSpy: () => void;
  onSwitchMode: (mode: 'listen' | 'whisper' | 'barge') => void;
}) {
  const cfg = AVAIL_CONFIG[agent.availability] ?? AVAIL_CONFIG.OFFLINE;
  const isBeingSpied = spySession?.targetExtension === agent.extension;
  const canSpy = agent.availability === 'IN_CALL' || agent.availability === 'RINGING';

  return (
    <div className={clsx(
      'rounded-xl border-2 p-4 transition-all',
      isBeingSpied ? 'border-primary-400 bg-primary-50 shadow-md' : cfg.color,
    )}>
      {/* Header agent */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center text-sm font-semibold text-gray-700">
              {agent.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
            </div>
            <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', cfg.dot)} />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{agent.name}</p>
            <p className="text-xs text-gray-500 font-mono">Ext. {agent.extension}</p>
          </div>
        </div>
        <span className={clsx('text-xs font-medium px-2 py-0.5 rounded-full bg-white/60')}>
          {cfg.label}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-white/70 rounded-lg px-2.5 py-1.5 text-center">
          <p className="text-lg font-bold text-gray-800">{agent.callsToday}</p>
          <p className="text-xs text-gray-500">Appels</p>
        </div>
        <div className="bg-white/70 rounded-lg px-2.5 py-1.5 text-center">
          <p className="text-lg font-bold text-gray-800">{fmt(agent.avgDuration)}</p>
          <p className="text-xs text-gray-500">Durée moy.</p>
        </div>
      </div>

      {/* Actions supervision */}
      {isBeingSpied ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary-700 bg-primary-100 rounded-lg px-3 py-2">
            {spySession!.mode === 'listen'  && <><Headphones size={13} /> Écoute active</>}
            {spySession!.mode === 'whisper' && <><Mic size={13} /> Whisper actif</>}
            {spySession!.mode === 'barge'   && <><Users size={13} /> Conférence active</>}
          </div>
          <div className="grid grid-cols-3 gap-1">
            {(['listen', 'whisper', 'barge'] as const).map((m) => (
              <button
                key={m}
                onClick={() => onSwitchMode(m)}
                disabled={spySession!.mode === m}
                className={clsx('text-xs py-1.5 rounded-lg font-medium transition-colors',
                  spySession!.mode === m
                    ? 'bg-primary-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40')}>
                {m === 'listen' ? '🎧' : m === 'whisper' ? '🗣️' : '👥'}
              </button>
            ))}
          </div>
          <button
            onClick={onStopSpy}
            className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 bg-red-50 border border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors">
            <StopCircle size={13} /> Arrêter
          </button>
        </div>
      ) : canSpy ? (
        <div className="grid grid-cols-3 gap-1">
          {([
            { mode: 'listen'  as const, icon: Headphones, label: 'Écouter' },
            { mode: 'whisper' as const, icon: Mic,        label: 'Whisper' },
            { mode: 'barge'   as const, icon: Users,      label: 'Rejoindre' },
          ]).map(({ mode, icon: Icon, label }) => (
            <button
              key={mode}
              onClick={() => onSpy(agent.extension, mode)}
              disabled={!supervisorExtension}
              className="flex flex-col items-center gap-1 py-2 bg-white border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:border-primary-300 hover:text-primary-700 transition-colors disabled:opacity-40">
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center py-2">
          <p className="text-xs text-gray-400">
            {agent.availability === 'PAUSED' ? 'Agent en pause' :
             agent.availability === 'OFFLINE' ? 'Hors ligne' :
             'En attente d\'appel'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function SupervisionPage() {
  const { user } = useAuthStore();
  const [snapshot,      setSnapshot]      = useState<SupervisorSnapshot | null>(null);
  const [spySessions,   setSpySessions]   = useState<SpySession[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [supervExt,     setSupervExt]     = useState('');
  const [filterAvail,   setFilterAvail]   = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const [snapRes, sessRes] = await Promise.allSettled([
        api.get('/calls/monitoring/snapshot'),
        api.get('/supervision/spy/sessions'),
      ]);
      if (snapRes.status === 'fulfilled') setSnapshot(snapRes.value.data);
      if (sessRes.status === 'fulfilled') setSpySessions(sessRes.value.data?.data ?? []);
    } catch (e: any) {
      console.error('[supervision]', e?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    intervalRef.current = setInterval(fetchSnapshot, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchSnapshot]);

  const startSpy = async (targetExtension: string, mode: 'listen' | 'whisper' | 'barge') => {
    if (!supervExt.trim()) {
      alert('Entrez votre extension SIP pour écouter');
      return;
    }
    setActionLoading(targetExtension);
    try {
      await api.post('/supervision/spy', { supervisorExtension: supervExt, targetExtension, mode });
      await fetchSnapshot();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erreur supervision');
    } finally { setActionLoading(null); }
  };

  const stopSpy = async () => {
    setActionLoading('stop');
    try {
      await api.delete('/supervision/spy');
      await fetchSnapshot();
    } finally { setActionLoading(null); }
  };

  const switchMode = async (mode: 'listen' | 'whisper' | 'barge') => {
    setActionLoading('switch');
    try {
      await api.post('/supervision/spy/switch', { mode });
      await fetchSnapshot();
    } finally { setActionLoading(null); }
  };

  const mySession = spySessions.find((s) => s.supervisorId === user?.id) ?? null;

  const agents = snapshot?.agents ?? [];
  const filtered = filterAvail ? agents.filter((a) => a.availability === filterAvail) : agents;

  const todayStats = snapshot?.today;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Supervision temps réel</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {agents.length} agent{agents.length > 1 ? 's' : ''} connecté{agents.length > 1 ? 's' : ''} —
            {' '}{agents.filter((a) => a.availability === 'IN_CALL').length} en appel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live — rafraîchissement 5s
          </div>
          <button onClick={fetchSnapshot} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* KPI globaux */}
      {todayStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Appels aujourd'hui", val: todayStats.totalCalls, icon: PhoneCall, color: 'text-primary-600' },
            { label: 'Décrochés',          val: todayStats.answered,   icon: Headphones, color: 'text-green-600' },
            { label: 'Taux décroché',      val: `${todayStats.answerRate}%`, icon: BarChart2, color: 'text-blue-600' },
            { label: 'Durée moy.',         val: fmt(todayStats.avgDuration), icon: Pause, color: 'text-yellow-600' },
            { label: 'Ventes',             val: todayStats.sales,      icon: Eye, color: 'text-purple-600' },
          ].map((s) => (
            <div key={s.label} className="card p-3 flex items-center gap-3">
              <s.icon size={18} className={s.color} />
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.val}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Extension superviseur + filtre */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Mon extension :</label>
          <input
            value={supervExt}
            onChange={(e) => setSupervExt(e.target.value)}
            placeholder="ex: 1001"
            className="input-field font-mono text-sm w-24"
          />
          <p className="text-xs text-gray-400">Requis pour écouter / whisper</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <label className="text-sm text-gray-600">Filtrer :</label>
          {['', 'IN_CALL', 'AVAILABLE', 'PAUSED', 'OFFLINE'].map((v) => (
            <button key={v} onClick={() => setFilterAvail(v)}
              className={clsx('px-3 py-1.5 text-xs rounded-lg font-medium transition-colors',
                filterAvail === v ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {v === '' ? 'Tous' : v === 'IN_CALL' ? 'En appel' : v === 'AVAILABLE' ? 'Disponible' : v === 'PAUSED' ? 'Pause' : 'Hors ligne'}
            </button>
          ))}
        </div>
      </div>

      {/* Session active */}
      {mySession && (
        <div className="bg-primary-50 border-2 border-primary-300 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Volume2 size={20} className="text-primary-600 animate-pulse" />
            <div>
              <p className="font-semibold text-primary-800">
                Session active : {mySession.mode === 'listen' ? 'Écoute' : mySession.mode === 'whisper' ? 'Whisper' : 'Conférence'}
              </p>
              <p className="text-sm text-primary-600">Extension cible : {mySession.targetExtension}</p>
            </div>
          </div>
          <button onClick={stopSpy} disabled={actionLoading === 'stop'}
            className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50">
            {actionLoading === 'stop' ? <Loader2 size={14} className="animate-spin" /> : <StopCircle size={14} />}
            Arrêter
          </button>
        </div>
      )}

      {/* Grille agents */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-gray-400">
          <Wifi size={36} className="mx-auto mb-3 opacity-20" />
          <p>{filterAvail ? 'Aucun agent dans ce statut' : 'Aucun agent connecté'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <AgentCard
              key={agent.agentId}
              agent={agent}
              spySession={mySession}
              supervisorExtension={supervExt}
              onSpy={startSpy}
              onStopSpy={stopSpy}
              onSwitchMode={switchMode}
            />
          ))}
        </div>
      )}
    </div>
  );
}
