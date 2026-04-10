'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, ChevronLeft, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { io, Socket } from 'socket.io-client';

interface PrivateChatMsg {
  id:        string;
  fromId:    string;
  fromName:  string;
  toId:      string;
  tenantId:  string;
  content:   string;
  sentAt:    string;
  direction: 'manager_to_agent' | 'agent_to_manager';
}

type Conversations = Record<string, PrivateChatMsg[]>;   // agentId → messages
type AgentInfo     = { agentId: string; name: string };

interface Props {
  userId:   string;
  tenantId: string;
  role:     string;
  name:     string;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3001';

export function ManagerChatWidget({ userId, tenantId, role, name }: Props) {
  const socketRef   = useRef<Socket | null>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  const [open, setOpen]         = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [text, setText]         = useState('');
  const [convs, setConvs]       = useState<Conversations>({});
  const [agents, setAgents]     = useState<AgentInfo[]>([]);
  const [unread, setUnread]     = useState<Record<string, number>>({});
  const [connected, setConnected] = useState(false);

  // ── Connexion socket /supervision ────────────────────────
  useEffect(() => {
    const sup = io(`${WS_URL}/supervision`, { transports: ['websocket'] });
    socketRef.current = sup;

    sup.on('connect', () => {
      setConnected(true);
      sup.emit('sup:join', { userId, tenantId, role, name });
    });
    sup.on('disconnect', () => setConnected(false));

    // Confirmation d'envoi → ajouter dans la conversation
    sup.on('sup:private:sent', (msg: PrivateChatMsg) => {
      setConvs((prev) => ({
        ...prev,
        [msg.toId]: [...(prev[msg.toId] ?? []), msg].slice(-100),
      }));
    });

    // Réponse de l'agent
    sup.on('sup:private:reply', (msg: PrivateChatMsg) => {
      setConvs((prev) => ({
        ...prev,
        [msg.fromId]: [...(prev[msg.fromId] ?? []), msg].slice(-100),
      }));
      setUnread((prev) => ({ ...prev, [msg.fromId]: (prev[msg.fromId] ?? 0) + 1 }));
    });

    // Snapshot agents disponibles via realtime
    const rt = io(`${WS_URL}/realtime`, { transports: ['websocket'] });
    rt.on('connect', () => rt.emit('rt:subscribe', { tenantId }));
    rt.on('rt:snapshot', (snap: any) => {
      const list: AgentInfo[] = (snap.agents ?? []).map((a: any) => ({
        agentId: a.agentId,
        name:    a.name ?? `Agent ${a.agentId.slice(0, 6)}`,
      }));
      setAgents(list);
    });

    return () => { sup.disconnect(); rt.disconnect(); };
  }, [userId, tenantId, role, name]);

  useEffect(() => {
    if (open && selected) {
      setUnread((prev) => ({ ...prev, [selected]: 0 }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, selected, convs]);

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || !selected) return;
    socketRef.current?.emit('sup:private:send', { toAgentId: selected, content: trimmed });
    setText('');
  }, [text, selected]);

  const thread = selected ? (convs[selected] ?? []) : [];
  const selectedAgent = agents.find((a) => a.agentId === selected);

  // ── Bouton flottant ──────────────────────────────────────
  const button = (
    <button
      onClick={() => setOpen((v) => !v)}
      title="Messagerie agents"
      className={clsx(
        'fixed bottom-5 right-24 z-50 w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all',
        open ? 'bg-indigo-700' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-105',
      )}
    >
      {open ? <X size={22} className="text-white" /> : <MessageSquare size={22} className="text-white" />}
      {!open && totalUnread > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
          {totalUnread > 9 ? '9+' : totalUnread}
        </span>
      )}
    </button>
  );

  if (!open) return button;

  return (
    <>
      {button}

      {/* Panel */}
      <div className="fixed bottom-24 right-24 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        style={{ height: 460 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-indigo-600 text-white shrink-0">
          {selected ? (
            <>
              <button onClick={() => setSelected(null)} className="hover:opacity-70 transition-opacity mr-2">
                <ChevronLeft size={18} />
              </button>
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">
                {selectedAgent?.name.charAt(0).toUpperCase()}
              </div>
              <span className="flex-1 ml-2 text-sm font-semibold truncate">{selectedAgent?.name}</span>
              {!connected && <span className="text-[10px] opacity-60">hors ligne</span>}
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <MessageSquare size={16} />
                <span className="text-sm font-semibold">Messages privés</span>
              </div>
              <div className={clsx('w-2 h-2 rounded-full', connected ? 'bg-green-400' : 'bg-red-400')} />
            </>
          )}
        </div>

        {/* Corps */}
        <div className="flex-1 min-h-0 flex flex-col">
          {!selected ? (
            // Liste des agents
            <div className="flex-1 overflow-y-auto">
              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2 p-6">
                  <Users size={28} className="opacity-30" />
                  <span>Aucun agent connecté</span>
                </div>
              ) : (
                agents.map((a) => {
                  const agentUnread = unread[a.agentId] ?? 0;
                  const last = (convs[a.agentId] ?? []).at(-1);
                  return (
                    <button
                      key={a.agentId}
                      onClick={() => setSelected(a.agentId)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                    >
                      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{a.name}</p>
                        {last ? (
                          <p className="text-[11px] text-gray-400 truncate">
                            {last.direction === 'manager_to_agent' ? 'Vous : ' : ''}{last.content}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-300 italic">Nouvelle conversation</p>
                        )}
                      </div>
                      {agentUnread > 0 && (
                        <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                          {agentUnread > 9 ? '9+' : agentUnread}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          ) : (
            // Fil de conversation
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
                {thread.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                    <MessageSquare size={22} className="opacity-30" />
                    <span>Démarrer la conversation</span>
                  </div>
                ) : (
                  thread.map((m) => {
                    const isMe = m.direction === 'manager_to_agent';
                    return (
                      <div key={m.id} className={clsx('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                        {!isMe && (
                          <span className="text-[10px] text-gray-400 px-1">{selectedAgent?.name}</span>
                        )}
                        <div className={clsx(
                          'max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                          isMe
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm shadow-sm',
                        )}>
                          {m.content}
                        </div>
                        <span className="text-[10px] text-gray-300 px-1">
                          {new Date(m.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t border-gray-100 flex gap-2 bg-white shrink-0">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={`Message à ${selectedAgent?.name}...`}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-indigo-300"
                />
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
