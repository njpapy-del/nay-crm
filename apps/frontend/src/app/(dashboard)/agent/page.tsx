'use client';

import { useState } from 'react';
import { Phone, Pause, Play, LogOut, Wifi, WifiOff } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useCallMonitor } from '@/hooks/use-call-monitor';
import { CallPanel, WrapUpPanel } from '@/components/telephony/call-panel';
import { Softphone } from '@/components/telephony/softphone';
import { PostCallModal } from '@/components/calls/PostCallModal';
import { usePostCall } from '@/hooks/usePostCall';
import { StatusPanel } from '@/components/agent-status/StatusPanel';
import { clsx } from 'clsx';
import { api } from '@/lib/api';

const AVAILABILITY_COLORS: Record<string, string> = {
  OFFLINE:   'bg-gray-400',
  AVAILABLE: 'bg-green-400',
  RINGING:   'bg-blue-400 animate-pulse',
  IN_CALL:   'bg-green-500',
  WRAP_UP:   'bg-yellow-400',
  PAUSED:    'bg-orange-400',
};
const AVAILABILITY_LABELS: Record<string, string> = {
  OFFLINE: 'Hors ligne', AVAILABLE: 'Disponible', RINGING: 'Sonnerie...',
  IN_CALL: 'En appel', WRAP_UP: 'Wrap-up', PAUSED: 'En pause',
};

export default function AgentPage() {
  const { user } = useAuthStore();
  const [extension, setExtension] = useState('');
  const [logged, setLogged] = useState(false);
  const [sipConfig, setSipConfig] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [postCallData, setPostCallData] = useState<{ callId: string; callLogId?: string } | null>(null);

  const { triggerPostCall } = usePostCall((payload) => setPostCallData(payload));

  const {
    connected, agentState, incomingCall, activeCall, wrapUp,
    pause, resume, endWrapUp, hangup,
  } = useCallMonitor({
    tenantId: user?.tenantId ?? '',
    agentId: logged ? user?.id : undefined,
    extension: logged ? extension : undefined,
    role: user?.role ?? 'AGENT',
  });

  const handleLogin = async () => {
    if (!extension.trim()) return;
    await api.post('/calls/agent/login', { extension });
    setSipConfig({
      wsUri: `wss://${window.location.hostname}:8089/ws`,
      sipUri: `sip:${extension}@${window.location.hostname}`,
      password: `Ag${extension}!Secure`,
      displayName: `${user?.firstName} ${user?.lastName}`,
    });
    setLogged(true);
  };

  const handleLogout = async () => {
    await api.post('/calls/agent/logout');
    setLogged(false);
    setSipConfig(null);
  };

  const handlePause = async () => {
    await api.post('/calls/agent/pause', { reason: pauseReason || 'Manuel' });
    pause(pauseReason || 'Manuel');
    setPauseReason('');
  };

  const handleResume = async () => {
    await api.post('/calls/agent/resume');
    resume();
  };

  if (!logged) {
    return (
      <div className="max-w-sm mx-auto mt-8 space-y-4">
        {/* Status panel always accessible */}
        <StatusPanel />

        <div className="text-center mt-4">
          <h1 className="text-2xl font-bold text-gray-900">Connexion Agent</h1>
          <p className="text-gray-500 text-sm mt-1">Entrez votre extension SIP pour commencer</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extension SIP</label>
            <input value={extension} onChange={(e) => setExtension(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="ex: 1000" className="input-field text-center text-xl font-mono" />
          </div>
          <button onClick={handleLogin} disabled={!extension.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            <Phone size={18} /> Se connecter
          </button>
        </div>
      </div>
    );
  }

  const availability = agentState?.availability ?? 'AVAILABLE';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Espace Agent</h1>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100">
            <span className={clsx('w-2.5 h-2.5 rounded-full', AVAILABILITY_COLORS[availability])} />
            <span className="text-sm font-medium text-gray-700">{AVAILABILITY_LABELS[availability]}</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">Ext. {extension}</span>
          <span className={clsx('flex items-center gap-1 text-xs', connected ? 'text-green-600' : 'text-red-500')}>
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            {connected ? 'WS connecté' : 'WS déconnecté'}
          </span>
        </div>
        <div className="flex gap-2">
          {availability === 'PAUSED' ? (
            <button onClick={handleResume} className="flex items-center gap-1.5 btn-secondary text-xs">
              <Play size={14} /> Reprendre
            </button>
          ) : availability === 'AVAILABLE' ? (
            <div className="flex items-center gap-2">
              <input value={pauseReason} onChange={(e) => setPauseReason(e.target.value)}
                placeholder="Raison pause..." className="border rounded px-2 py-1 text-xs w-32" />
              <button onClick={handlePause} className="flex items-center gap-1.5 btn-secondary text-xs">
                <Pause size={14} /> Pause
              </button>
            </div>
          ) : null}
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors">
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </div>

      {/* Appel entrant / preview */}
      {incomingCall && !activeCall && (
        <div className="card p-5 border-2 border-blue-400 bg-blue-50 space-y-3 animate-pulse-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center">
              <Phone size={20} />
            </div>
            <div>
              <p className="font-semibold text-blue-900">Appel entrant</p>
              <p className="text-sm text-blue-700">
                {incomingCall.lead
                  ? `${incomingCall.lead.firstName} ${incomingCall.lead.lastName} — ${incomingCall.lead.phone}`
                  : incomingCall.callerNumber}
              </p>
            </div>
          </div>
          {incomingCall.lead && (
            <div className="bg-white rounded-lg p-3 text-sm space-y-1">
              {incomingCall.lead.company && <p className="text-gray-600">🏢 {incomingCall.lead.company}</p>}
            </div>
          )}
        </div>
      )}

      {/* Appel actif */}
      {activeCall && (
        <div className="card p-5 border-2 border-green-400">
          <CallPanel
            callId={activeCall.callId}
            lead={incomingCall?.lead}
            callerNumber={incomingCall?.callerNumber}
            startedAt={activeCall.startedAt}
            isMuted={isMuted}
            onMute={setIsMuted}
            onHangup={() => hangup('')}
            onDispositionSaved={() => {}}
          />
        </div>
      )}

      {/* Wrap-up */}
      {wrapUp && !activeCall && (
        <WrapUpPanel callId={wrapUp.callId} onDone={endWrapUp} />
      )}

      {/* Disponible — message */}
      {availability === 'AVAILABLE' && !incomingCall && !activeCall && !wrapUp && (
        <div className="card p-8 text-center text-gray-400">
          <Phone size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="font-medium">En attente d'appel...</p>
          <p className="text-xs mt-1">Vous serez notifié dès qu'un appel arrive</p>
        </div>
      )}

      {/* Statut agent */}
      <StatusPanel />

      {/* Softphone WebRTC */}
      <Softphone config={sipConfig} />

      {/* Simulation button (dev only) */}
      {process.env.NODE_ENV === 'development' && (
        <button
          onClick={() => triggerPostCall({ callId: 'test-' + Date.now() })}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-60 hover:opacity-100 transition-opacity"
        >
          Simuler fin d'appel
        </button>
      )}

      {/* Post-call qualification modal */}
      {postCallData && (
        <PostCallModal
          callId={postCallData.callId}
          callLogId={postCallData.callLogId}
          onClose={() => setPostCallData(null)}
          onNextCall={() => setPostCallData(null)}
        />
      )}
    </div>
  );
}
