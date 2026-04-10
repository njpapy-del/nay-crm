'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquare, X, Send, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import type { PrivateChatMsg } from '@/hooks/use-call-monitor';

interface Props {
  messages:       PrivateChatMsg[];
  unread:         number;
  onReply:        (toManagerId: string, content: string) => void;
  onClearUnread:  () => void;
}

export function AgentManagerChat({ messages, unread, onReply, onClearUnread }: Props) {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState('');
  const bottomRef         = useRef<HTMLDivElement>(null);

  // Déduit l'ID du manager depuis le dernier message entrant
  const lastManagerId = [...messages]
    .reverse()
    .find((m) => m.direction === 'manager_to_agent')?.fromId ?? null;

  useEffect(() => {
    if (open) {
      onClearUnread();
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [open, messages.length, onClearUnread]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || !lastManagerId) return;
    onReply(lastManagerId, trimmed);
    setText('');
  };

  return (
    <div className="fixed bottom-5 left-5 z-50 flex flex-col items-start gap-2">
      {/* Panel */}
      {open && (
        <div className="w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden mb-2"
          style={{ height: 420 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-primary-600 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare size={16} />
              <span className="text-sm font-semibold">Message manager</span>
            </div>
            <button onClick={() => setOpen(false)} className="hover:opacity-70 transition-opacity">
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 text-xs gap-2">
                <MessageSquare size={28} className="opacity-30" />
                <span>Aucun message de votre manager</span>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.direction === 'agent_to_manager';
                return (
                  <div key={m.id} className={clsx('flex flex-col gap-0.5', isMe ? 'items-end' : 'items-start')}>
                    {!isMe && (
                      <span className="text-[10px] text-gray-400 px-1">
                        {m.fromName || 'Manager'}
                      </span>
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
              placeholder={lastManagerId ? 'Répondre au manager...' : 'En attente d\'un message...'}
              disabled={!lastManagerId}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary-300 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || !lastManagerId}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          'relative w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all',
          open ? 'bg-primary-700' : 'bg-primary-600 hover:bg-primary-700',
        )}
      >
        {open ? <X size={22} className="text-white" /> : <MessageSquare size={22} className="text-white" />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
