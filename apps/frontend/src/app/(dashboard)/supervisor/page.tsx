'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Phone, TrendingUp, Clock, Users, Target,
  Wifi, WifiOff,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useSupervision } from '@/hooks/use-supervision';
import { AgentCardLive } from '@/components/supervisor/agent-card-live';
import { LiveChat } from '@/components/supervisor/live-chat';
import { DialerSlider } from '@/components/supervisor/dialer-slider';
import { ClientCardPopup } from '@/components/supervisor/client-card-popup';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const SUPERVISOR_EXTENSION = '2000';  // extension SIP du superviseur

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={clsx('p-2.5 rounded-xl text-white', color)}><Icon size={17} /></div>
      <div>
        <p className="text-[11px] text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900 leading-none mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m${s % 60}s` : `${s}s`;
}

export default function SupervisorPage() {
  const { user }  = useAuthStore();
  const [tab, setTab] = useState<'agents' | 'calls' | 'chat'>('agents');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [chatTarget, setChatTarget] = useState<string | undefined>(undefined);
  const chatPanelRef = useRef<boolean>(false);

  const {
    connected, snapshot, messages, spyActive, spyTarget, spyMode,
    clientCard, startSpy, switchMode, stopSpy, sendMessage, dismissCard,
  } = useSupervision(
    user?.tenantId ?? '',
    user?.id ?? '',
    `${user?.firstName} ${user?.lastName}`,
    user?.role ?? 'MANAGER',
  );

  useEffect(() => {
    api.get('/campaigns?status=ACTIVE&limit=50').then((r) => setCampaigns(r.data.data)).catch(() => {});
  }, []);

  const handleStartDialer = useCallback(async (campaignId: string, mode: string, ratio: number) => {
    await api.post('/calls/dialer/start', { campaignId, mode, ratio });
  }, []);

  const handleStopDialer = useCallback(async (campaignId: string) => {
    await api.post(`/calls/dialer/stop/${campaignId}`);
  }, []);

  const openChatTo = (agentId: string) => {
    setChatTarget(agentId);
    setTab('chat');
    chatPanelRef.current = true;
  };

  const kpis = snapshot?.kpis;
  const agents = snapshot?.agents ?? [];
  const activeCalls = snapshot?.activeCalls ?? [];

  const agentCallMap = Object.fromEntries(activeCalls.map((c) => [c.agentId ?? '', c]));

  return (
    <div className="flex gap-5 h-[calc(100vh-5rem)] overflow-hidden">

      {/* ── Colonne principale ──────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 overflow-y-auto pr-1">

        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Supervision temps réel</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={clsx('flex items-center gap-1.5 text-xs font-medium',
                connected ? 'text-green-600' : 'text-red-500')}>
                {connected
                  ? <><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />Live</>
                  : <><WifiOff size={11} /> Déconnecté</>}
              </span>
              {snapshot && (
                <span className="text-[10px] text-gray-400">
                  {new Date(snapshot.timestamp).toLocaleTimeString('fr-FR')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-5 gap-3 shrink-0">
          <KpiCard label="Appels auj." value={kpis?.totalCallsToday ?? 0}   icon={Phone}      color="bg-primary-600" />
          <KpiCard label="Décrochés"   value={kpis?.answeredToday ?? 0}     icon={TrendingUp} color="bg-green-500"   />
          <KpiCard label="Taux"        value={`${kpis?.answerRate ?? 0}%`}  icon={Target}     color="bg-blue-500"    />
          <KpiCard label="Durée moy."  value={fmtDur(kpis?.avgDuration ?? 0)} icon={Clock}   color="bg-purple-500"  />
          <KpiCard label="En appel"    value={kpis?.activeCallsNow ?? 0}    icon={Wifi}       color="bg-emerald-500" />
        </div>

        {/* Statuts agents */}
        <div className="grid grid-cols-4 gap-3 shrink-0">
          {[
            { label: 'En ligne',    val: kpis?.agentsOnline    ?? 0, color: 'text-gray-700   border-gray-200  bg-gray-50'      },
            { label: 'Disponibles', val: kpis?.agentsAvailable ?? 0, color: 'text-green-700  border-green-100 bg-green-50'     },
            { label: 'En appel',    val: kpis?.agentsInCall    ?? 0, color: 'text-emerald-700 border-emerald-100 bg-emerald-50' },
            { label: 'Ventes',      val: kpis?.salesToday      ?? 0, color: 'text-yellow-700 border-yellow-200 bg-yellow-50'   },
          ].map((s) => (
            <div key={s.label} className={clsx('card p-4 text-center border-2', s.color)}>
              <p className="text-3xl font-bold">{s.val}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Onglets */}
        <div className="flex gap-1 shrink-0">
          {([
            ['agents', `Agents (${agents.length})`],
            ['calls',  `Appels actifs (${activeCalls.length})`],
            ['chat',   'Messages'],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={clsx('px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                tab === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {label}
            </button>
          ))}
        </div>

        {/* Contenu onglet AGENTS */}
        {tab === 'agents' && (
          <div className="space-y-2">
            {agents.length === 0 ? (
              <div className="card p-10 text-center text-gray-400">
                <Users size={36} className="mx-auto mb-2 opacity-20" />
                Aucun agent connecté
              </div>
            ) : (
              agents.map((agent) => (
                <AgentCardLive
                  key={agent.agentId}
                  agent={agent}
                  activeCall={agentCallMap[agent.agentId]}
                  supervisorExtension={SUPERVISOR_EXTENSION}
                  spyingThisAgent={spyActive && spyTarget === agent.extension}
                  spyMode={spyActive && spyTarget === agent.extension ? spyMode : undefined}
                  onStartSpy={startSpy}
                  onSwitchSpy={switchMode}
                  onStopSpy={stopSpy}
                  onMessage={openChatTo}
                />
              ))
            )}
          </div>
        )}

        {/* Onglet APPELS ACTIFS */}
        {tab === 'calls' && (
          <div className="card overflow-hidden">
            {activeCalls.length === 0 ? (
              <div className="p-8 text-center text-gray-400">Aucun appel en cours</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Agent', 'De', 'Vers', 'Durée', 'Statut'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {activeCalls.map((call) => (
                    <tr key={call.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{call.agentName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{call.callerNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{call.calleeNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-green-600 font-semibold">{fmtDur(call.duration)}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                          call.status === 'ANSWERED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                          {call.status === 'ANSWERED' ? 'En cours' : 'Sonnerie'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Onglet MESSAGES */}
        {tab === 'chat' && (
          <div className="card flex-1 overflow-hidden" style={{ height: 420 }}>
            <LiveChat
              messages={messages}
              agents={agents.map((a) => ({ agentId: a.agentId, name: a.name }))}
              currentUserId={user?.id ?? ''}
              onSend={(content, toAgentId) => {
                sendMessage(content, toAgentId ?? chatTarget);
                setChatTarget(undefined);
              }}
            />
          </div>
        )}
      </div>

      {/* ── Colonne droite — Dialer ──────────────────────────── */}
      <div className="w-72 shrink-0 flex flex-col gap-4 overflow-y-auto">
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4 text-sm">Dialer automatique</h2>
          <DialerSlider
            campaigns={campaigns}
            activeSessions={snapshot?.dialer ?? []}
            onStart={handleStartDialer}
            onStop={handleStopDialer}
          />
        </div>

        {/* Sessions espionnage actives */}
        {(snapshot?.spySessions ?? []).length > 0 && (
          <div className="card p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">Supervisions actives</h3>
            {snapshot!.spySessions.map((s) => (
              <div key={s.supervisorId} className="flex items-center justify-between text-xs py-1">
                <span className="text-gray-700">Ext. {s.supervisorExtension}</span>
                <span className="text-gray-400">→ {s.targetExtension}</span>
                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium capitalize">{s.mode}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Popup fiche client ───────────────────────────────── */}
      {clientCard && <ClientCardPopup card={clientCard} onClose={dismissCard} />}
    </div>
  );
}
