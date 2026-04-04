'use client';

import { useState } from 'react';
import { Phone, Clock, Pause, Ear, MessageSquare, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { SpyControls } from './spy-controls';
import type { RealtimeAgent, RealtimeCall } from '@/hooks/use-supervision';

const AVAIL_DOT: Record<string, string> = {
  OFFLINE:   'bg-gray-400',
  AVAILABLE: 'bg-green-400',
  RINGING:   'bg-blue-400 animate-pulse',
  IN_CALL:   'bg-green-500',
  WRAP_UP:   'bg-yellow-400',
  PAUSED:    'bg-orange-400',
};
const AVAIL_LABEL: Record<string, string> = {
  OFFLINE: 'Hors ligne', AVAILABLE: 'Disponible', RINGING: 'Sonnerie…',
  IN_CALL: 'En appel', WRAP_UP: 'Wrap-up', PAUSED: 'En pause',
};
const AVAIL_ROW: Record<string, string> = {
  OFFLINE:   'border-gray-100 bg-gray-50',
  AVAILABLE: 'border-green-100 bg-green-50/40',
  RINGING:   'border-blue-200 bg-blue-50',
  IN_CALL:   'border-emerald-200 bg-emerald-50',
  WRAP_UP:   'border-yellow-200 bg-yellow-50',
  PAUSED:    'border-orange-100 bg-orange-50/40',
};

function fmtSec(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

interface Props {
  agent: RealtimeAgent;
  activeCall?: RealtimeCall;
  supervisorExtension: string;
  spyingThisAgent: boolean;
  spyMode?: string;
  onStartSpy: (ext: string, supExt: string, mode: 'listen' | 'whisper' | 'barge') => void;
  onSwitchSpy: (mode: 'listen' | 'whisper' | 'barge') => void;
  onStopSpy: () => void;
  onMessage: (agentId: string) => void;
}

export function AgentCardLive({
  agent, activeCall, supervisorExtension,
  spyingThisAgent, spyMode, onStartSpy, onSwitchSpy, onStopSpy, onMessage,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const canSpy = agent.availability === 'IN_CALL' || agent.availability === 'RINGING';

  return (
    <div className={clsx('border rounded-xl overflow-hidden transition-all', AVAIL_ROW[agent.availability])}>
      {/* Ligne principale */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-sm font-bold flex items-center justify-center">
            {agent.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <span className={clsx('absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white', AVAIL_DOT[agent.availability])} />
        </div>

        {/* Identité + état */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 text-sm truncate">{agent.name}</span>
            <span className="text-xs text-gray-400 font-mono shrink-0">#{agent.extension}</span>
          </div>
          <p className="text-xs text-gray-500">{AVAIL_LABEL[agent.availability]}</p>
        </div>

        {/* Stats rapides */}
        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          {activeCall && (
            <span className="flex items-center gap-1 text-green-600 font-mono font-medium">
              <Phone size={11} /> {fmtSec(activeCall.duration)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Phone size={11} /> {agent.callsToday}
          </span>
          {agent.avgDurationToday > 0 && (
            <span className="flex items-center gap-1">
              <Clock size={11} /> {fmtSec(agent.avgDurationToday)}
            </span>
          )}
        </div>

        {/* Actions rapides */}
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onMessage(agent.agentId)} title="Message"
            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-white/70 transition-colors">
            <MessageSquare size={15} />
          </button>
          {canSpy && (
            <button onClick={() => setExpanded((e) => !e)} title="Superviser"
              className={clsx('p-1.5 rounded-lg transition-colors',
                spyingThisAgent ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:text-blue-600 hover:bg-white/70')}>
              <Ear size={15} />
            </button>
          )}
          {canSpy && (
            <button onClick={() => setExpanded((e) => !e)}
              className="p-1 text-gray-300 hover:text-gray-500">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Appel en cours */}
      {activeCall && (
        <div className="px-4 pb-2 flex items-center gap-2 text-xs text-gray-600">
          <Phone size={11} className="text-green-500 shrink-0" />
          <span className="font-mono truncate">{activeCall.callerNumber}</span>
          <span className="text-gray-400">→</span>
          <span className="font-mono truncate">{activeCall.calleeNumber}</span>
        </div>
      )}

      {/* Panel supervision étendu */}
      {expanded && canSpy && (
        <div className="px-4 pb-4 pt-1 border-t border-white/60">
          <SpyControls
            agentExtension={agent.extension}
            agentName={agent.name}
            supervisorExtension={supervisorExtension}
            active={spyingThisAgent}
            currentMode={spyMode as any}
            onStart={onStartSpy}
            onSwitch={onSwitchSpy}
            onStop={onStopSpy}
          />
        </div>
      )}
    </div>
  );
}
