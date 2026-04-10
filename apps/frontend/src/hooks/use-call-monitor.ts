'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type AgentAvailability = 'OFFLINE' | 'AVAILABLE' | 'RINGING' | 'IN_CALL' | 'WRAP_UP' | 'PAUSED';

export interface AgentState {
  agentId: string;
  name: string;
  extension: string;
  availability: AgentAvailability;
  currentCallId: string | null;
  callsToday: number;
  avgDuration: number;
}

export interface SupervisorSnapshot {
  agents: AgentState[];
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

export interface IncomingCall {
  callId?: string;
  channel?: string;
  callerNumber: string;
  callerName?: string;
  lead?: { id: string; firstName: string; lastName: string; phone: string; company?: string };
  source?: 'dialer' | 'inbound';
}

interface UseCallMonitorOptions {
  tenantId: string;
  agentId?: string;
  extension?: string;
  role: 'AGENT' | 'MANAGER' | 'ADMIN';
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function useCallMonitor({ tenantId, agentId, extension, role }: UseCallMonitorOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [snapshot, setSnapshot] = useState<SupervisorSnapshot | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [activeCall, setActiveCall] = useState<{ callId: string; startedAt: Date } | null>(null);
  const [wrapUp, setWrapUp] = useState<{ callId: string } | null>(null);
  const [chatMessages, setChatMessages] = useState<PrivateChatMsg[]>([]);
  const [chatUnread, setChatUnread] = useState(0);

  useEffect(() => {
    const socket = io(`${WS_URL}/telephony`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);

      if (agentId && extension) {
        socket.emit('agent:login', { agentId, tenantId, extension });
      }

      if (role === 'MANAGER' || role === 'ADMIN') {
        socket.emit('supervisor:subscribe', { tenantId });
      }
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('agent:state', (state: AgentState) => setAgentState(state));
    socket.on('agent:state:update', (state: AgentState) => {
      if (state.agentId === agentId) setAgentState(state);
    });

    socket.on('call:ringing', (data: IncomingCall) => setIncomingCall(data));
    socket.on('call:preview', (data: IncomingCall) => setIncomingCall(data));

    socket.on('call:answered', (data: { callId: string }) => {
      setIncomingCall(null);
      setActiveCall({ callId: data.callId, startedAt: new Date() });
    });

    socket.on('call:hangup', () => {
      setIncomingCall(null);
      setActiveCall(null);
    });

    socket.on('call:wrap_up', (data: { callId: string }) => {
      setActiveCall(null);
      setWrapUp(data);
    });

    socket.on('supervisor:snapshot', (snap: SupervisorSnapshot) => setSnapshot(snap));

    socket.on('chat:private', (msg: PrivateChatMsg) => {
      setChatMessages((prev) => [...prev, msg].slice(-100));
      setChatUnread((n) => n + 1);
    });

    socket.on('chat:private:sent', (msg: PrivateChatMsg) => {
      setChatMessages((prev) => [...prev, msg].slice(-100));
    });

    return () => { socket.disconnect(); socketRef.current = null; };
  }, [tenantId, agentId, extension, role]);

  const pause = useCallback((reason?: string) => {
    socketRef.current?.emit('agent:pause', { reason });
  }, []);

  const resume = useCallback(() => {
    socketRef.current?.emit('agent:resume');
  }, []);

  const endWrapUp = useCallback(() => {
    socketRef.current?.emit('agent:wrap_up:done');
    setWrapUp(null);
  }, []);

  const hangup = useCallback((channel: string) => {
    socketRef.current?.emit('call:hangup', { channel });
  }, []);

  const replyToManager = useCallback((toManagerId: string, content: string) => {
    socketRef.current?.emit('agent:chat:reply', { toManagerId, content });
  }, []);

  const clearChatUnread = useCallback(() => setChatUnread(0), []);

  return {
    connected,
    agentState,
    snapshot,
    incomingCall,
    activeCall,
    wrapUp,
    chatMessages,
    chatUnread,
    pause,
    resume,
    endWrapUp,
    hangup,
    replyToManager,
    clearChatUnread,
  };
}
