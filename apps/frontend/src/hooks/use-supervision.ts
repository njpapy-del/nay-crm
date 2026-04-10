'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface RealtimeAgent {
  agentId: string;
  name: string;
  extension: string;
  availability: string;
  currentCallId: string | null;
  callsToday: number;
  avgDurationToday: number;
  pauseReason: string | null;
}

export interface RealtimeCall {
  id: string;
  agentId: string | null;
  agentName: string;
  callerNumber: string;
  calleeNumber: string;
  direction: string;
  status: string;
  duration: number;
  startedAt: string;
}

export interface RealtimeKpis {
  totalCallsToday: number;
  answeredToday: number;
  answerRate: number;
  avgDuration: number;
  salesToday: number;
  activeCallsNow: number;
  agentsOnline: number;
  agentsAvailable: number;
  agentsInCall: number;
}

export interface RealtimeSnapshot {
  agents: RealtimeAgent[];
  activeCalls: RealtimeCall[];
  dialer: { campaignId: string; mode: string; active: boolean }[];
  kpis: RealtimeKpis;
  spySessions: { supervisorId: string; supervisorExtension: string; targetExtension: string; mode: string }[];
  timestamp: string;
}

export interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  toAgentId?: string;
  content: string;
  sentAt: string;
}

export interface PrivateChatMsg {
  id:        string;
  fromId:    string;
  fromName:  string;
  toId:      string;
  tenantId:  string;
  content:   string;
  sentAt:    string;
  direction: 'manager_to_agent' | 'agent_to_manager';
}

// Map agentId → messages de la conversation
export type PrivateConversations = Record<string, PrivateChatMsg[]>;

type SpyMode = 'listen' | 'whisper' | 'barge';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function useSupervision(tenantId: string, userId: string, name: string, role: string) {
  const rtSocket  = useRef<Socket | null>(null);
  const supSocket = useRef<Socket | null>(null);

  const [snapshot, setSnapshot]           = useState<RealtimeSnapshot | null>(null);
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [privateConvs, setPrivateConvs]   = useState<PrivateConversations>({});
  const [unreadPerAgent, setUnreadPerAgent] = useState<Record<string, number>>({});
  const [spyActive, setSpyActive]         = useState(false);
  const [spyTarget, setSpyTarget]         = useState<string | null>(null);
  const [spyMode, setSpyMode]             = useState<SpyMode>('listen');
  const [clientCard, setClientCard]       = useState<any | null>(null);
  const [connected, setConnected]         = useState(false);

  useEffect(() => {
    if (!tenantId) return;

    // ── Socket realtime (snapshot) ────────────────────────
    const rt = io(`${WS_URL}/realtime`, { transports: ['websocket'] });
    rtSocket.current = rt;

    rt.on('connect', () => {
      setConnected(true);
      rt.emit('rt:subscribe', { tenantId });
    });
    rt.on('disconnect', () => setConnected(false));
    rt.on('rt:snapshot', (snap: RealtimeSnapshot) => setSnapshot(snap));

    // ── Socket supervision (spy + messages) ───────────────
    const sup = io(`${WS_URL}/supervision`, { transports: ['websocket'] });
    supSocket.current = sup;

    sup.on('connect', () => {
      sup.emit('sup:join', { userId, tenantId, role, name });
    });
    sup.on('sup:spy:started',  (s: any) => { setSpyActive(true); setSpyTarget(s.targetExtension); setSpyMode(s.mode); });
    sup.on('sup:spy:stopped',  ()       => { setSpyActive(false); setSpyTarget(null); });
    sup.on('sup:message:received', (msg: ChatMessage) => setMessages((prev) => [msg, ...prev].slice(0, 100)));
    sup.on('sup:message:sent',     (msg: ChatMessage) => setMessages((prev) => [msg, ...prev].slice(0, 100)));
    sup.on('sup:client:card',      (card: any)        => setClientCard(card));

    // ── Chat privé : message envoyé confirmé (manager→agent) ──
    sup.on('sup:private:sent', (msg: PrivateChatMsg) => {
      setPrivateConvs((prev) => ({
        ...prev,
        [msg.toId]: [...(prev[msg.toId] ?? []), msg].slice(-100),
      }));
    });

    // ── Chat privé : réponse reçue (agent→manager) ────────────
    sup.on('sup:private:reply', (msg: PrivateChatMsg) => {
      setPrivateConvs((prev) => ({
        ...prev,
        [msg.fromId]: [...(prev[msg.fromId] ?? []), msg].slice(-100),
      }));
      setUnreadPerAgent((prev) => ({ ...prev, [msg.fromId]: (prev[msg.fromId] ?? 0) + 1 }));
    });

    return () => { rt.disconnect(); sup.disconnect(); };
  }, [tenantId, userId, name, role]);

  // ── Actions ChanSpy ───────────────────────────────────────

  const startSpy = useCallback((targetExtension: string, supervisorExtension: string, mode: SpyMode = 'listen') => {
    supSocket.current?.emit('sup:spy', { targetExtension, supervisorExtension, mode });
  }, []);

  const switchMode = useCallback((mode: SpyMode) => {
    supSocket.current?.emit('sup:spy:switch', { mode });
    setSpyMode(mode);
  }, []);

  const stopSpy = useCallback(() => {
    supSocket.current?.emit('sup:spy:stop');
  }, []);

  // ── Messagerie ────────────────────────────────────────────

  const sendMessage = useCallback((content: string, toAgentId?: string) => {
    supSocket.current?.emit('sup:message', { content, toAgentId });
  }, []);

  const sendPrivate = useCallback((toAgentId: string, content: string) => {
    supSocket.current?.emit('sup:private:send', { toAgentId, content });
  }, []);

  const clearAgentUnread = useCallback((agentId: string) => {
    setUnreadPerAgent((prev) => ({ ...prev, [agentId]: 0 }));
  }, []);

  const dismissCard = useCallback(() => setClientCard(null), []);

  return {
    connected, snapshot, messages, spyActive, spyTarget, spyMode,
    clientCard, startSpy, switchMode, stopSpy, sendMessage, dismissCard,
    privateConvs, unreadPerAgent, sendPrivate, clearAgentUnread,
  };
}
