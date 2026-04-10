'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Hash, Plus, Send, Trash2, Edit2, Check, X, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { io, Socket } from 'socket.io-client';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsgUser { id: string; firstName: string; lastName: string; role: string; }
interface Message {
  id: string; channelId: string; userId: string; content: string;
  createdAt: string; editedAt?: string | null; deletedAt?: string | null;
  user: MsgUser;
}
interface Channel { id: string; name: string; description?: string; isDefault: boolean; _count: { messages: number }; }

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

const ROLE_COLOR: Record<string, string> = {
  ADMIN:   'text-red-600',
  MANAGER: 'text-orange-600',
  AGENT:   'text-blue-600',
  QUALITY: 'text-purple-600',
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin', MANAGER: 'Manager', AGENT: 'Agent', QUALITY: 'Qualité',
};

// ─── Composant message ────────────────────────────────────────────────────────

function MessageItem({
  msg, isMine, isAdmin,
  onDelete, onEdit,
}: {
  msg: Message; isMine: boolean; isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(msg.content);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const handleEdit = () => {
    if (editVal.trim() && editVal !== msg.content) onEdit(msg.id, editVal.trim());
    setEditing(false);
  };

  const name = `${msg.user.firstName} ${msg.user.lastName}`;
  const initials = `${msg.user.firstName[0]}${msg.user.lastName[0]}`.toUpperCase();
  const canDelete = isMine || isAdmin;
  const time = new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={clsx('flex gap-3 group px-4 py-1.5 hover:bg-gray-50 rounded-lg', isMine && 'flex-row-reverse')}>
      {/* Avatar */}
      <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5',
        isMine ? 'bg-primary-500' : 'bg-gray-400')}>
        {initials}
      </div>

      {/* Bulle */}
      <div className={clsx('flex-1 min-w-0', isMine && 'items-end flex flex-col')}>
        <div className={clsx('flex items-baseline gap-2 mb-0.5', isMine && 'flex-row-reverse')}>
          <span className={clsx('text-xs font-semibold', ROLE_COLOR[msg.user.role] ?? 'text-gray-700')}>{name}</span>
          <span className="text-[10px] text-gray-400">{ROLE_LABEL[msg.user.role]}</span>
          <span className="text-[10px] text-gray-300">{time}</span>
          {msg.editedAt && <span className="text-[10px] text-gray-300 italic">modifié</span>}
        </div>

        {editing ? (
          <div className="flex items-center gap-2 w-full max-w-md">
            <input ref={inputRef} value={editVal} onChange={e => setEditVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleEdit(); if (e.key === 'Escape') setEditing(false); }}
              className="input-field text-sm flex-1 py-1" />
            <button onClick={handleEdit} className="text-green-600 hover:text-green-700"><Check size={14} /></button>
            <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
        ) : (
          <div className={clsx('relative max-w-md',)}>
            <p className={clsx('text-sm px-3 py-2 rounded-2xl leading-relaxed break-words',
              isMine ? 'bg-primary-500 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm')}>
              {msg.content}
            </p>
            {/* Actions au survol */}
            <div className={clsx('absolute top-1 hidden group-hover:flex items-center gap-1 bg-white border border-gray-200 rounded-lg shadow-sm px-1 py-0.5',
              isMine ? '-left-20' : '-right-20')}>
              {isMine && (
                <button onClick={() => { setEditVal(msg.content); setEditing(true); }}
                  className="p-1 text-gray-400 hover:text-gray-700" title="Modifier">
                  <Edit2 size={11} />
                </button>
              )}
              {canDelete && (
                <button onClick={() => onDelete(msg.id)}
                  className="p-1 text-red-400 hover:text-red-600" title="Supprimer">
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [channels,       setChannels]       = useState<Channel[]>([]);
  const [activeChannel,  setActiveChannel]  = useState<Channel | null>(null);
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [typingUsers,    setTypingUsers]    = useState<Set<string>>(new Set());
  const [newChanName,    setNewChanName]    = useState('');
  const [showNewChan,    setShowNewChan]    = useState(false);


  const socketRef  = useRef<Socket | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const typingRef  = useRef<ReturnType<typeof setTimeout>>();

  // ─── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = document.cookie.split('; ').find(r => r.startsWith('accessToken='))?.split('=')[1] ?? '';
    const sock = io(`${BACKEND}/internal-chat`, {
      auth: { token },
    });
    socketRef.current = sock;

    sock.on('chat:message', (msg: Message) => {
      setMessages(prev => [...prev, msg]);
    });

    sock.on('chat:history', (msgs: Message[]) => {
      setMessages(msgs);
    });

    sock.on('chat:edited', ({ messageId, content, editedAt }: any) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, content, editedAt } : m));
    });

    sock.on('chat:deleted', ({ messageId }: any) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    sock.on('chat:typing', ({ userId, isTyping }: any) => {
      setTypingUsers(prev => {
        const next = new Set(prev);
        isTyping ? next.add(userId) : next.delete(userId);
        return next;
      });
    });

    return () => { sock.disconnect(); };
  }, []);

  // ─── Charger les channels ──────────────────────────────────────────────────

  const loadChannels = useCallback(async () => {
    try {
      const res = await api.get('/internal-chat/channels');
      const chans: Channel[] = res.data?.data ?? res.data ?? [];
      setChannels(chans);
      if (chans.length && !activeChannel) {
        const def = chans.find(c => c.isDefault) ?? chans[0];
        joinChannel(def, chans);
      }
    } catch {}
  }, []); // eslint-disable-line

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const joinChannel = (chan: Channel, chans?: Channel[]) => {
    setActiveChannel(chan);
    setMessages([]);
    socketRef.current?.emit('chat:join', { channelId: chan.id });
    // Mettre à jour la liste si fournie
    if (chans) setChannels(chans);
  };

  // ─── Scroll bas ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Envoi message ─────────────────────────────────────────────────────────

  const sendMessage = () => {
    if (!input.trim() || !activeChannel) return;
    socketRef.current?.emit('chat:send', { channelId: activeChannel.id, content: input.trim() });
    setInput('');
    stopTyping();
  };

  // ─── Frappe en cours ───────────────────────────────────────────────────────

  const handleTyping = (val: string) => {
    setInput(val);
    if (!activeChannel) return;
    socketRef.current?.emit('chat:typing', { channelId: activeChannel.id, isTyping: true });
    clearTimeout(typingRef.current);
    typingRef.current = setTimeout(() => stopTyping(), 2000);
  };

  const stopTyping = () => {
    if (!activeChannel) return;
    socketRef.current?.emit('chat:typing', { channelId: activeChannel.id, isTyping: false });
    clearTimeout(typingRef.current);
  };

  // ─── Supprimer / Éditer ────────────────────────────────────────────────────

  const handleDelete = (messageId: string) => {
    socketRef.current?.emit('chat:delete', { messageId, channelId: activeChannel?.id });
  };

  const handleEdit = (messageId: string, content: string) => {
    socketRef.current?.emit('chat:edit', { messageId, channelId: activeChannel?.id, content });
  };

  // ─── Créer channel ─────────────────────────────────────────────────────────

  const createChannel = async () => {
    if (!newChanName.trim()) return;
    try {
      await api.post('/internal-chat/channels', { name: newChanName.trim() });
      setNewChanName(''); setShowNewChan(false);
      loadChannels();
    } catch {}
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Sidebar channels */}
      <aside className="w-60 bg-gray-900 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-sm">Chat équipe</h2>
          <p className="text-gray-400 text-xs mt-0.5">Messagerie interne</p>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {channels.map(chan => (
            <button key={chan.id} onClick={() => joinChannel(chan)}
              className={clsx('w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                activeChannel?.id === chan.id
                  ? 'bg-gray-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200')}>
              <Hash size={13} className="shrink-0" />
              <span className="truncate">{chan.name}</span>
              {chan.isDefault && <span className="ml-auto text-[9px] text-gray-500 uppercase">défaut</span>}
            </button>
          ))}
        </div>

        {/* Nouveau canal */}
        {isAdmin && (
          <div className="p-3 border-t border-gray-700">
            {showNewChan ? (
              <div className="space-y-2">
                <input value={newChanName} onChange={e => setNewChanName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') createChannel(); if (e.key === 'Escape') setShowNewChan(false); }}
                  className="w-full bg-gray-800 text-white text-xs px-2 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-gray-400 placeholder:text-gray-500"
                  placeholder="Nom du canal…" autoFocus />
                <div className="flex gap-2">
                  <button onClick={createChannel} className="flex-1 text-xs bg-primary-600 text-white rounded py-1 hover:bg-primary-700">Créer</button>
                  <button onClick={() => setShowNewChan(false)} className="flex-1 text-xs text-gray-400 hover:text-gray-200 rounded py-1">Annuler</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowNewChan(true)}
                className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-gray-300 px-2 py-1.5 rounded hover:bg-gray-800 transition-colors">
                <Plus size={13} /> Nouveau canal
              </button>
            )}
          </div>
        )}
      </aside>

      {/* Zone messages */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header canal */}
        {activeChannel && (
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100 bg-white">
            <Hash size={16} className="text-gray-400" />
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">{activeChannel.name}</h3>
              {activeChannel.description && (
                <p className="text-xs text-gray-400">{activeChannel.description}</p>
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400">
              <Users size={13} />
              {messages.length > 0
                ? `${new Set(messages.map(m => m.userId)).size} participant(s)`
                : 'Aucun message'}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {!activeChannel && (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Sélectionnez un canal pour commencer
            </div>
          )}

          {activeChannel && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Hash size={32} className="text-gray-300" />
              <p className="text-sm">Aucun message — soyez le premier !</p>
            </div>
          )}

          {messages.map(msg => (
            <MessageItem
              key={msg.id}
              msg={msg}
              isMine={msg.userId === user?.id}
              isAdmin={isAdmin}
              onDelete={handleDelete}
              onEdit={handleEdit}
            />
          ))}

          {/* Indicateur frappe */}
          {typingUsers.size > 0 && (
            <div className="px-4 py-1 text-xs text-gray-400 italic flex items-center gap-1.5">
              <span className="flex gap-0.5">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
              {typingUsers.size === 1 ? 'quelqu\'un écrit…' : `${typingUsers.size} personnes écrivent…`}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        {activeChannel && (
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus-within:border-primary-400 focus-within:bg-white transition-colors">
              <input
                value={input}
                onChange={e => handleTyping(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                onBlur={stopTyping}
                className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
                placeholder={`Message dans #${activeChannel.name}…`}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim()}
                className="p-1.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                <Send size={14} />
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1 px-1">Entrée pour envoyer · Survolez un message pour le modifier/supprimer</p>
          </div>
        )}
      </div>
    </div>
  );
}
