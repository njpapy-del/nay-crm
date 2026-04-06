'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';

export interface PostCallPayload {
  callId: string;
  callLogId?: string;
  source?: string;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export function usePostCall(onPostCall: (payload: PostCallPayload) => void) {
  const { user } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);
  const callbackRef = useRef(onPostCall);
  callbackRef.current = onPostCall;

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

    // Triggered by dialer (predictive/progressive)
    socket.on('call:postcall', (data: PostCallPayload) => {
      callbackRef.current(data);
    });

    // Triggered by AMI hangup (manual calls)
    socket.on('call:hangup', (data: any) => {
      if (data.callId || data.callLogId) {
        callbackRef.current({ callId: data.callId ?? '', callLogId: data.callLogId, source: 'ami' });
      }
    });

    return () => { socket.disconnect(); };
  }, [user?.id]);

  // Manual trigger (for testing / simulation button)
  const triggerPostCall = (payload: PostCallPayload) => {
    callbackRef.current(payload);
  };

  return { triggerPostCall };
}
