'use client';

import { useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import type { ChatMessage } from '@/hooks/use-supervision';

interface Agent { agentId: string; name: string; }

interface Props {
  messages: ChatMessage[];
  agents: Agent[];
  currentUserId: string;
  onSend: (content: string, toAgentId?: string) => void;
}

export function LiveChat({ messages, agents, currentUserId, onSend }: Props) {
  const [text, setText]         = useState('');
  const [target, setTarget]     = useState('');  // '' = broadcast
  const bottomRef               = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, target || undefined);
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Cible du message */}
      <div className="p-3 border-b border-gray-100">
        <select value={target} onChange={(e) => setTarget(e.target.value)}
          className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-1 focus:ring-primary-300">
          <option value="">📢 Tous les agents</option>
          {agents.map((a) => (
            <option key={a.agentId} value={a.agentId}>🧑 {a.name}</option>
          ))}
        </select>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 mt-4">
            <MessageSquare size={24} className="mx-auto mb-1 opacity-30" />
            Aucun message
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.fromId === currentUserId;
            return (
              <div key={m.id} className={clsx('flex flex-col gap-0.5', isMine ? 'items-end' : 'items-start')}>
                {!isMine && (
                  <span className="text-[10px] text-gray-400 px-1">{m.fromName}</span>
                )}
                <div className={clsx('max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                  isMine ? 'bg-primary-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm')}>
                  {m.toAgentId && (
                    <span className={clsx('font-semibold block text-[10px] mb-0.5',
                      isMine ? 'text-white/70' : 'text-primary-600')}>
                      Privé →
                    </span>
                  )}
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
      <div className="p-3 border-t border-gray-100 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={target ? 'Message privé...' : 'Message à tous...'}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary-300"
        />
        <button onClick={handleSend} disabled={!text.trim()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0">
          <Send size={14} />
        </button>
      </div>
    </div>
  );
}
