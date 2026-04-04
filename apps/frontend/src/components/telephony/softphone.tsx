'use client';

import { useState } from 'react';
import {
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff,
  ChevronDown, ChevronUp, Wifi, WifiOff,
} from 'lucide-react';
import { useSip, SipConfig } from '@/hooks/use-sip';
import { clsx } from 'clsx';

const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Déconnecté',
  connecting:   'Connexion...',
  registered:   'Disponible',
  calling:      'Appel...',
  'in-call':    'En communication',
  error:        'Erreur SIP',
};

const STATUS_COLORS: Record<string, string> = {
  disconnected: 'bg-gray-400',
  connecting:   'bg-yellow-400 animate-pulse',
  registered:   'bg-green-400',
  calling:      'bg-blue-400 animate-pulse',
  'in-call':    'bg-green-500',
  error:        'bg-red-500',
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

interface Props { config: SipConfig | null; }

export function Softphone({ config }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [dialInput, setDialInput] = useState('');
  const { status, incomingCall, call, answer, hangup, mute, duration, isMuted } = useSip(config);

  const handleDial = () => {
    if (!dialInput.trim()) return;
    call(dialInput.trim());
  };

  const handleKey = (k: string) => setDialInput((v) => v + k);

  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 bg-gray-900 text-white px-3 py-2 rounded-full shadow-lg hover:bg-gray-800 transition-colors">
          <span className={clsx('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
          <Phone size={16} />
          {status === 'in-call' && <span className="text-xs font-mono">{formatDuration(duration)}</span>}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-gray-900 text-white rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className={clsx('w-2 h-2 rounded-full', STATUS_COLORS[status])} />
          <span className="text-xs font-medium">{STATUS_LABELS[status]}</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-gray-400 hover:text-white">
          <ChevronDown size={16} />
        </button>
      </div>

      {/* Incoming call */}
      {incomingCall && (
        <div className="px-4 py-4 bg-blue-900/50 space-y-3 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center mx-auto">
            <PhoneIncoming size={22} className="text-blue-300" />
          </div>
          <div>
            <p className="text-sm font-semibold">{incomingCall.displayName}</p>
            <p className="text-xs text-gray-400">{incomingCall.number}</p>
          </div>
          <div className="flex justify-center gap-4">
            <button onClick={hangup}
              className="w-11 h-11 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600">
              <PhoneOff size={18} />
            </button>
            <button onClick={answer}
              className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center hover:bg-green-600">
              <Phone size={18} />
            </button>
          </div>
        </div>
      )}

      {/* In call */}
      {status === 'in-call' && !incomingCall && (
        <div className="px-4 py-4 text-center space-y-3">
          <p className="text-2xl font-mono text-green-400">{formatDuration(duration)}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => mute(!isMuted)}
              className={clsx('w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                isMuted ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20')}>
              {isMuted ? <MicOff size={16} /> : <Mic size={16} />}
            </button>
            <button onClick={hangup}
              className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600">
              <PhoneOff size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Dialpad — affiché si disponible */}
      {status === 'registered' && !incomingCall && (
        <div className="px-4 py-4 space-y-3">
          <input
            value={dialInput}
            onChange={(e) => setDialInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleDial()}
            placeholder="Numéro ou extension..."
            className="w-full bg-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-1 focus:ring-primary-500"
          />
          {/* Touches */}
          <div className="grid grid-cols-3 gap-1.5">
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((k) => (
              <button key={k} onClick={() => handleKey(k)}
                className="h-9 rounded-lg bg-white/10 text-sm font-medium hover:bg-white/20 transition-colors">
                {k}
              </button>
            ))}
          </div>
          <button onClick={handleDial} disabled={!dialInput}
            className="w-full h-10 rounded-lg bg-green-500 flex items-center justify-center gap-2 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            <Phone size={16} /> Appeler
          </button>
        </div>
      )}

      {/* Calling spinner */}
      {status === 'calling' && !incomingCall && (
        <div className="px-4 py-6 text-center space-y-2">
          <p className="text-sm text-gray-300">Appel en cours...</p>
          <p className="text-lg font-semibold">{dialInput}</p>
          <button onClick={hangup} className="mt-3 w-11 h-11 rounded-full bg-red-500 flex items-center justify-center mx-auto hover:bg-red-600">
            <PhoneOff size={18} />
          </button>
        </div>
      )}

      {/* Disconnected */}
      {(status === 'disconnected' || status === 'error') && (
        <div className="px-4 py-4 text-center text-sm text-gray-400 flex flex-col items-center gap-2">
          <WifiOff size={24} className="text-gray-600" />
          Softphone déconnecté<br />
          <span className="text-xs">Vérifiez la configuration SIP</span>
        </div>
      )}
    </div>
  );
}
