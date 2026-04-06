'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatusType =
  | 'AVAILABLE' | 'IN_CALL' | 'DEBRIEF'
  | 'LUNCH_BREAK' | 'COFFEE_BREAK' | 'TRAINING' | 'OFFLINE';

interface StatusMeta {
  label: string;
  color: string;
  bg: string;
  dot: string;
  icon: string;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<AgentStatusType, StatusMeta> = {
  AVAILABLE:    { label: 'Disponible',      color: 'text-green-700',  bg: 'bg-green-50  border-green-300',  dot: 'bg-green-500',   icon: '🟢' },
  IN_CALL:      { label: 'En appel',        color: 'text-blue-700',   bg: 'bg-blue-50   border-blue-300',   dot: 'bg-blue-500',    icon: '📞' },
  DEBRIEF:      { label: 'Débrief',         color: 'text-purple-700', bg: 'bg-purple-50 border-purple-300', dot: 'bg-purple-500',  icon: '📋' },
  LUNCH_BREAK:  { label: 'Pause déjeuner',  color: 'text-orange-700', bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-500',  icon: '🍽️' },
  COFFEE_BREAK: { label: 'Pause café',      color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-300',  dot: 'bg-amber-500',   icon: '☕' },
  TRAINING:     { label: 'Formation',       color: 'text-teal-700',   bg: 'bg-teal-50   border-teal-300',   dot: 'bg-teal-500',    icon: '📚' },
  OFFLINE:      { label: 'Hors ligne',      color: 'text-gray-600',   bg: 'bg-gray-50   border-gray-300',   dot: 'bg-gray-400',    icon: '⚫' },
};

const ALL_STATUSES = Object.keys(STATUS_META) as AgentStatusType[];

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDuration = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`;
  return `${m}m ${String(s).padStart(2,'0')}s`;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusPanel() {
  const { user } = useAuthStore();
  const [current, setCurrent] = useState<{ status: AgentStatusType; startedAt: string } | null>(null);
  const [elapsed, setElapsed]  = useState(0);
  const [loading, setLoading]  = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Load current status on mount
  useEffect(() => {
    api.get('/agent-status/current').then(r => {
      const d = r.data?.data ?? r.data;
      if (d?.status) {
        setCurrent({ status: d.status, startedAt: d.startedAt });
        setElapsed(d.durationSec ?? 0);
      }
    }).catch(() => {});
  }, []);

  // WS subscription for status updates from other sessions
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(`${BACKEND}/telephony`, { transports: ['websocket'] });
    socketRef.current = socket;
    socket.on('connect', () => {
      socket.emit('agent:login', {
        agentId: user.id,
        tenantId: (user as any).tenantId ?? '',
        extension: (user as any).extension ?? '100',
      });
    });
    socket.on('agent:status:update', (data: any) => {
      if (data.agentId === user.id) {
        setCurrent({ status: data.status, startedAt: data.log?.startedAt });
        setElapsed(0);
      }
    });
    return () => { socket.disconnect(); };
  }, [user?.id]);

  // Live timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [current?.startedAt]);

  const changeStatus = useCallback(async (status: AgentStatusType) => {
    setLoading(true);
    try {
      const res = await api.post('/agent-status/change', { status });
      setCurrent({ status, startedAt: res.data.startedAt });
      setElapsed(0);
    } finally { setLoading(false); }
  }, []);

  const meta = current ? STATUS_META[current.status] : STATUS_META.OFFLINE;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Current status header */}
      <div className={clsx('flex items-center justify-between px-5 py-3 border-b', meta.bg)}>
        <div className="flex items-center gap-2.5">
          <span className={clsx('w-3 h-3 rounded-full animate-pulse', meta.dot)} />
          <span className={clsx('font-semibold text-sm', meta.color)}>
            {meta.icon} {meta.label}
          </span>
        </div>
        {current && (
          <span className={clsx('font-mono text-sm font-bold tabular-nums', meta.color)}>
            {fmtDuration(elapsed)}
          </span>
        )}
      </div>

      {/* Status buttons */}
      <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
        {ALL_STATUSES.map((s) => {
          const m = STATUS_META[s];
          const active = current?.status === s;
          return (
            <button
              key={s}
              disabled={loading || active}
              onClick={() => changeStatus(s)}
              className={clsx(
                'flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition-all',
                active
                  ? clsx('border-current scale-105 shadow-sm', m.bg, m.color)
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50',
                loading && !active ? 'opacity-50 cursor-not-allowed' : '',
              )}
            >
              <span className="text-lg leading-none">{m.icon}</span>
              <span className="text-center leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
