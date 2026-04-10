'use client';

import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare, ChevronLeft } from 'lucide-react';
import { clsx } from 'clsx';
import type { PrivateChatMsg, PrivateConversations } from '@/hooks/use-supervision';

interface Agent { agentId: string; name: string; }

interface Props {
  agents:           Agent[];
  conversations:    PrivateConversations;
  unreadPerAgent:   Record<string, number>;
  initialAgent?:    string;
  onSend:           (toAgentId: string, content: string) => void;
  onClearUnread:    (agentId: string) => void;
}

export function LiveChat({ agents, conversations, unreadPerAgent, initialAgent, onSend, onClearUnread }: Props) {
  const [selected, setSelected] = useState<string | null>(initialAgent ?? null);
  const [text, setText]         = useState('');
  const bottomRef               = useRef<HTMLDivElement>(null);

  // Sync quand le parent change l'agent présélectionné (ex: clic "Envoyer message" sur carte agent)
  useEffect(() => {
    if (initialAgent) setSelected(initialAgent);
  }, [initialAgent]);

  const selectedAgent = agents.find((a) => a.agentId === selected);
  const thread: PrivateChatMsg[] = selected ? (conversations[selected] ?? []) : [];

  useEffect(() => {
    if (selected) {
      onClearUnread(selected);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [selected, thread.length, onClearUnread]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !selected) return;
    onSend(selected, trimmed);
    setText('');
  };

  // ── Vue liste agents ──────────────────────────────────────
  if (!selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 pt-3 pb-2">
          <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide">Choisir un agent</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2 p-4">
              <MessageSquare size={24} className="opacity-30" />
              <span>Aucun agent connecté</span>
            </div>
          ) : (
            agents.map((a) => {
              const unread = unreadPerAgent[a.agentId] ?? 0;
              const lastMsg = (conversations[a.agentId] ?? []).at(-1);
              return (
                <button
                  key={a.agentId}
                  onClick={() => setSelected(a.agentId)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors text-left border-b border-gray-50"
                >
                  <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">
                    {a.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{a.name}</p>
                    {lastMsg && (
                      <p className="text-[10px] text-gray-400 truncate">
                        {lastMsg.direction === 'manager_to_agent' ? 'Vous : ' : ''}{lastMsg.content}
                      </p>
                    )}
                  </div>
                  {unread > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ── Vue conversation ──────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
          {selectedAgent?.name.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-semibold text-gray-800 truncate">{selectedAgent?.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50/50">
        {thread.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
            <MessageSquare size={22} className="opacity-30" />
            <span>Commencez la conversation</span>
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
                    ? 'bg-primary-600 text-white rounded-br-sm'
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
      <div className="p-3 border-t border-gray-100 flex gap-2 bg-white">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={`Message à ${selectedAgent?.name}...`}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary-300"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
