'use client';

/**
 * Maintient la connexion WebSocket agent active même en naviguant entre les pages.
 * À monter dans le DashboardLayout (niveau layout, jamais démonté).
 */

import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth.store';
import { useAgentStore } from '@/stores/agent.store';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function AgentKeepAlive() {
  const { user } = useAuthStore();
  const { logged, extension } = useAgentStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!logged || !extension || !user) {
      // Pas connecté en tant qu'agent → ferme le socket si ouvert
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Déjà connecté avec la bonne extension → ne reconnecte pas
    if (socketRef.current?.connected) return;

    const socket = io(`${WS_URL}/telephony`, { transports: ['websocket'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('agent:login', {
        agentId: user.id,
        tenantId: user.tenantId,
        extension,
      });
    });

    // Reconnexion automatique si coupure réseau
    socket.on('disconnect', () => {
      // socket.io gère la reconnexion automatiquement
    });

    return () => {
      // Ne pas déconnecter ici — ce composant ne se démonte jamais (layout)
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logged, extension, user?.id]);

  // Nettoyage seulement quand le layout lui-même se démonte (logout app)
  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  return null; // Pas de rendu visible
}
