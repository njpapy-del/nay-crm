'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type SipStatus = 'disconnected' | 'connecting' | 'registered' | 'calling' | 'in-call' | 'error';

export interface SipConfig {
  wsUri: string;        // wss://asterisk:8089/ws
  sipUri: string;       // sip:1000@asterisk
  password: string;
  displayName?: string;
}

export interface UseSipReturn {
  status: SipStatus;
  incomingCall: { number: string; displayName: string } | null;
  call: (destination: string) => void;
  answer: () => void;
  hangup: () => void;
  mute: (muted: boolean) => void;
  duration: number;
  isMuted: boolean;
}

/**
 * Hook WebRTC SIP via JsSIP
 * Charge JsSIP dynamiquement (ESM) car incompatible SSR
 */
export function useSip(config: SipConfig | null): UseSipReturn {
  const [status, setStatus] = useState<SipStatus>('disconnected');
  const [incomingCall, setIncomingCall] = useState<{ number: string; displayName: string } | null>(null);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  const uaRef       = useRef<any>(null);
  const sessionRef  = useRef<any>(null);
  const timerRef    = useRef<NodeJS.Timeout | null>(null);
  const audioRef    = useRef<HTMLAudioElement | null>(null);

  // Initialiser UA JsSIP
  useEffect(() => {
    if (!config || typeof window === 'undefined') return;

    let JsSIP: any;
    const init = async () => {
      try {
        JsSIP = (await import('jssip')).default ?? (await import('jssip'));
        JsSIP.debug.disable('JsSIP:*');

        const socket = new JsSIP.WebSocketInterface(config.wsUri);
        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: config.sipUri,
          password: config.password,
          display_name: config.displayName ?? 'Agent',
          register: true,
          register_expires: 300,
        });

        ua.on('registered', () => setStatus('registered'));
        ua.on('unregistered', () => setStatus('disconnected'));
        ua.on('registrationFailed', () => setStatus('error'));
        ua.on('newRTCSession', (data: any) => handleNewSession(data.session, data.originator));

        ua.start();
        uaRef.current = ua;
        setStatus('connecting');
      } catch (err) {
        console.error('JsSIP init error:', err);
        setStatus('error');
      }
    };

    init();
    return () => { uaRef.current?.stop(); uaRef.current = null; };
  }, [config?.sipUri]);

  const startTimer = useCallback(() => {
    setDuration(0);
    timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setDuration(0);
  }, []);

  const attachAudio = (session: any) => {
    session.connection?.addEventListener('addstream', (e: any) => {
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.srcObject = e.stream;
      audioRef.current.play().catch(console.error);
    });
  };

  const handleNewSession = useCallback((session: any, originator: string) => {
    sessionRef.current = session;

    session.on('ended', () => { setStatus('registered'); stopTimer(); setIncomingCall(null); });
    session.on('failed', () => { setStatus('registered'); stopTimer(); setIncomingCall(null); });
    session.on('accepted', () => { setStatus('in-call'); startTimer(); });
    session.on('confirmed', () => { setStatus('in-call'); startTimer(); });

    if (originator === 'remote') {
      const number = session.remote_identity?.uri?.user ?? 'Inconnu';
      const displayName = session.remote_identity?.display_name ?? number;
      setIncomingCall({ number, displayName });
      setStatus('calling');
    }
  }, [startTimer, stopTimer]);

  const call = useCallback((destination: string) => {
    if (!uaRef.current || status !== 'registered') return;
    const session = uaRef.current.call(destination, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });
    attachAudio(session);
    setStatus('calling');
  }, [status]);

  const answer = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.answer({ mediaConstraints: { audio: true, video: false } });
    attachAudio(sessionRef.current);
    setIncomingCall(null);
  }, []);

  const hangup = useCallback(() => {
    if (!sessionRef.current) return;
    try { sessionRef.current.terminate(); } catch { /* already ended */ }
    sessionRef.current = null;
  }, []);

  const mute = useCallback((muted: boolean) => {
    if (!sessionRef.current) return;
    muted ? sessionRef.current.mute({ audio: true }) : sessionRef.current.unmute({ audio: true });
    setIsMuted(muted);
  }, []);

  return { status, incomingCall, call, answer, hangup, mute, duration, isMuted };
}
