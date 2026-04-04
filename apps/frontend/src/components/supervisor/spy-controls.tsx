'use client';

import { useState } from 'react';
import { Ear, MessageSquare, Users, StopCircle, Radio } from 'lucide-react';
import { clsx } from 'clsx';

type SpyMode = 'listen' | 'whisper' | 'barge';

const MODES: { value: SpyMode; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { value: 'listen',  label: 'Écoute',       icon: Ear,           desc: 'Silencieuse — personne ne vous entend',   color: 'bg-blue-500'  },
  { value: 'whisper', label: 'Chuchotement', icon: MessageSquare, desc: 'Agent vous entend, client non',            color: 'bg-yellow-500'},
  { value: 'barge',   label: 'Intrusion',    icon: Users,         desc: 'Conversation à 3 — tout le monde entend', color: 'bg-red-500'   },
];

interface Props {
  agentExtension: string;
  agentName: string;
  supervisorExtension: string;
  active: boolean;
  currentMode?: SpyMode;
  onStart:  (ext: string, supExt: string, mode: SpyMode) => void;
  onSwitch: (mode: SpyMode) => void;
  onStop:   () => void;
}

export function SpyControls({
  agentExtension, agentName, supervisorExtension,
  active, currentMode, onStart, onSwitch, onStop,
}: Props) {
  const [mode, setMode] = useState<SpyMode>('listen');

  if (active) {
    return (
      <div className="space-y-2 p-3 bg-red-50 border border-red-200 rounded-xl">
        <div className="flex items-center gap-2">
          <Radio size={14} className="text-red-500 animate-pulse" />
          <span className="text-xs font-semibold text-red-700">
            {MODES.find((m) => m.value === currentMode)?.label} — {agentName}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MODES.map((m) => (
            <button key={m.value} onClick={() => onSwitch(m.value)}
              className={clsx('text-xs py-1 px-2 rounded font-medium transition-colors',
                currentMode === m.value ? `${m.color} text-white` : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {m.label}
            </button>
          ))}
        </div>
        <button onClick={onStop}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-red-600 hover:bg-red-100 py-1.5 rounded-lg transition-colors">
          <StopCircle size={14} /> Arrêter l'écoute
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 font-medium">Superviser {agentName}</p>
      <div className="space-y-1">
        {MODES.map((m) => (
          <button key={m.value} onClick={() => setMode(m.value)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-left transition-all',
              mode === m.value ? `border-current ${m.color} text-white` : 'border-gray-100 text-gray-700 hover:border-gray-200',
            )}>
            <m.icon size={14} className="shrink-0" />
            <div>
              <div className="text-xs font-semibold">{m.label}</div>
              <div className={clsx('text-[10px]', mode === m.value ? 'text-white/80' : 'text-gray-400')}>{m.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <button onClick={() => onStart(agentExtension, supervisorExtension, mode)}
        className="w-full btn-primary text-sm flex items-center justify-center gap-2 py-2">
        <Radio size={14} /> Démarrer ({MODES.find((m2) => m2.value === mode)?.label})
      </button>
    </div>
  );
}
