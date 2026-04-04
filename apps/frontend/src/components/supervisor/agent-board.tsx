'use client';

import { Phone, PhoneOff, Clock, Pause, Wifi } from 'lucide-react';
import { clsx } from 'clsx';
import type { AgentState, AgentAvailability } from '@/hooks/use-call-monitor';

const AVAIL_CONFIG: Record<AgentAvailability, { label: string; dot: string; row: string }> = {
  OFFLINE:   { label: 'Hors ligne', dot: 'bg-gray-400',                 row: 'bg-gray-50 border-gray-100' },
  AVAILABLE: { label: 'Disponible', dot: 'bg-green-400',                row: 'bg-green-50 border-green-100' },
  RINGING:   { label: 'Sonnerie',   dot: 'bg-blue-400 animate-pulse',   row: 'bg-blue-50 border-blue-200' },
  IN_CALL:   { label: 'En appel',   dot: 'bg-green-500',                row: 'bg-emerald-50 border-emerald-200' },
  WRAP_UP:   { label: 'Wrap-up',    dot: 'bg-yellow-400',               row: 'bg-yellow-50 border-yellow-200' },
  PAUSED:    { label: 'En pause',   dot: 'bg-orange-400',               row: 'bg-orange-50 border-orange-100' },
};

function AgentAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

interface Props {
  agents: AgentState[];
}

export function AgentBoard({ agents }: Props) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Wifi size={32} className="mx-auto mb-2 opacity-30" />
        Aucun agent connecté
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {agents.map((agent) => {
        const cfg = AVAIL_CONFIG[agent.availability];
        return (
          <div key={agent.agentId}
            className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border transition-all', cfg.row)}>
            <AgentAvatar name={agent.name} />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 text-sm">{agent.name}</span>
                <span className="text-xs text-gray-400 font-mono">#{agent.extension}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={clsx('w-1.5 h-1.5 rounded-full', cfg.dot)} />
                <span className="text-xs text-gray-500">{cfg.label}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
              <span className="flex items-center gap-1">
                <Phone size={12} /> {agent.callsToday}
              </span>
              {agent.avgDuration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {fmtDuration(agent.avgDuration)}
                </span>
              )}
              {agent.availability === 'IN_CALL' && (
                <span className="flex items-center gap-1 text-green-600 font-medium">
                  <Phone size={12} className="text-green-500" /> En communication
                </span>
              )}
              {agent.availability === 'PAUSED' && (
                <span className="flex items-center gap-1 text-orange-600">
                  <Pause size={12} /> Pause
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
