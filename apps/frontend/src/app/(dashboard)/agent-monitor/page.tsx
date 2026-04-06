'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { RefreshCw, AlertTriangle, Users, Clock, TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatusType =
  | 'AVAILABLE' | 'IN_CALL' | 'DEBRIEF'
  | 'LUNCH_BREAK' | 'COFFEE_BREAK' | 'TRAINING' | 'OFFLINE';

interface AgentSnap {
  id: string;
  status: AgentStatusType;
  startedAt: string;
  durationSec: number;
  alert: boolean;
  agent: { id: string; firstName: string; lastName: string };
}

const STATUS_META: Record<AgentStatusType, { label: string; icon: string; dot: string; color: string }> = {
  AVAILABLE:    { label: 'Disponible',     icon: '🟢', dot: 'bg-green-500',  color: 'text-green-700'  },
  IN_CALL:      { label: 'En appel',       icon: '📞', dot: 'bg-blue-500',   color: 'text-blue-700'   },
  DEBRIEF:      { label: 'Débrief',        icon: '📋', dot: 'bg-purple-500', color: 'text-purple-700' },
  LUNCH_BREAK:  { label: 'Pause déjeuner', icon: '🍽️', dot: 'bg-orange-500', color: 'text-orange-700' },
  COFFEE_BREAK: { label: 'Pause café',     icon: '☕', dot: 'bg-amber-500',  color: 'text-amber-700'  },
  TRAINING:     { label: 'Formation',      icon: '📚', dot: 'bg-teal-500',   color: 'text-teal-700'   },
  OFFLINE:      { label: 'Hors ligne',     icon: '⚫', dot: 'bg-gray-400',   color: 'text-gray-500'   },
};

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${String(s).padStart(2, '0')}s`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentMonitorPage() {
  const { user } = useAuthStore();
  const [agents, setAgents]     = useState<AgentSnap[]>([]);
  const [ticks,  setTicks]      = useState(0);
  const [loading, setLoading]   = useState(true);
  const socketRef = useRef<Socket | null>(null);

  const fetchSnapshot = useCallback(async () => {
    const res = await api.get('/agent-status/team-snapshot').catch(() => null);
    if (res?.data) {
      const list = res.data.data ?? res.data;
      setAgents(Array.isArray(list) ? list : []);
    }
    setLoading(false);
  }, []);

  // Poll every 30s + live tick every 1s for timers
  useEffect(() => {
    fetchSnapshot();
    const poll = setInterval(fetchSnapshot, 30_000);
    const tick = setInterval(() => setTicks(t => t + 1), 1_000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [fetchSnapshot]);

  // WS for real-time status changes
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${BACKEND}/telephony`, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('supervisor:subscribe', { tenantId: (user as any).tenantId ?? '' });
    });
    socket.on('agent:status:update', () => { fetchSnapshot(); });
    return () => { socket.disconnect(); };
  }, [user?.id, fetchSnapshot]);

  // Counters
  const online     = agents.filter(a => a.status !== 'OFFLINE').length;
  const inCall     = agents.filter(a => a.status === 'IN_CALL').length;
  const alerts     = agents.filter(a => a.alert).length;

  // Live durations (ticks drives re-render)
  const now = Date.now();
  const liveAgents = agents.map(a => ({
    ...a,
    liveSec: Math.floor((now - new Date(a.startedAt).getTime()) / 1000),
  }));

  void ticks; // used to re-render every second

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi Temps Réel</h1>
          <p className="text-gray-500 text-sm mt-0.5">Statuts agents en direct</p>
        </div>
        <button onClick={fetchSnapshot} className="btn-secondary flex items-center gap-1.5 text-sm">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connectés',    value: online,  icon: Users,         color: 'text-green-600',  bg: 'bg-green-100'  },
          { label: 'En appel',     value: inCall,  icon: Clock,         color: 'text-blue-600',   bg: 'bg-blue-100'   },
          { label: 'Alertes',      value: alerts,  icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-100'    },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={clsx('p-2 rounded-lg', k.bg, k.color)}>
              <k.icon size={18} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{k.label}</p>
              <p className="text-2xl font-bold text-gray-900">{k.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Agent table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 text-sm font-semibold text-gray-600">
          {agents.length} agent(s) suivi(s)
        </div>
        {loading ? (
          <div className="py-10 text-center text-gray-400">Chargement…</div>
        ) : liveAgents.length === 0 ? (
          <div className="py-10 text-center text-gray-400">Aucun agent actif</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Agent', 'Statut', 'Depuis', 'Durée', 'Alerte'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {liveAgents.map((a) => {
                const m = STATUS_META[a.status] ?? STATUS_META.OFFLINE;
                return (
                  <tr key={a.id} className={clsx('transition-colors', a.alert ? 'bg-red-50' : 'hover:bg-gray-50')}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {a.agent.firstName} {a.agent.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('flex items-center gap-2 font-medium', m.color)}>
                        <span className={clsx('w-2 h-2 rounded-full', m.dot)} />
                        {m.icon} {m.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(a.startedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-bold tabular-nums text-gray-700">
                      {fmtDuration(a.liveSec)}
                    </td>
                    <td className="px-4 py-3">
                      {a.alert && (
                        <span className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                          <AlertTriangle size={13} /> Dépassé
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Légende alertes</p>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span>🍽️ Pause déjeuner : alerte après <strong>60 min</strong></span>
          <span>☕ Pause café : alerte après <strong>15 min</strong></span>
          <span>📋 Débrief : alerte après <strong>20 min</strong></span>
        </div>
      </div>
    </div>
  );
}
