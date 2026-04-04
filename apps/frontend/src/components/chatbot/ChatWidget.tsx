'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MessageCircle, X, Send, Loader2, Bell, BellOff,
  CheckCircle2, Clock, Trash2, ChevronDown,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { io, Socket } from 'socket.io-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChatMsg {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt?: string;
}

interface Reminder {
  id: string;
  title: string;
  description?: string;
  dueAt: string;
  isDone: boolean;
  client?: { firstName: string; lastName: string; phone: string };
}

interface ReminderNotif {
  type: 'reminder';
  reminderId: string;
  message: string;
  reminder: Reminder;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

// ─── Widget ───────────────────────────────────────────────────────────────────

export function ChatWidget() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'reminders'>('chat');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [notifs, setNotifs] = useState<ReminderNotif[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // ── WebSocket pour rappels temps réel ──────────────────────────────────
  useEffect(() => {
    if (!user?.sub) return;
    const sock = io(`${BACKEND}/chatbot`, { transports: ['websocket'] });
    socketRef.current = sock;
    sock.on('connect', () => sock.emit('join', { userId: user.sub }));
    sock.on('reminder:due', (notif: ReminderNotif) => {
      setNotifs((prev) => [notif, ...prev.slice(0, 4)]);
      setUnread((n) => n + 1);
      setMessages((prev) => [...prev, { role: 'system', content: notif.message }]);
    });
    return () => { sock.disconnect(); };
  }, [user?.sub]);

  // ── Charger historique + rappels + alertes ─────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [histRes, remRes, alertRes] = await Promise.all([
        api.get('/chatbot/history?limit=30'),
        api.get('/chatbot/reminders?pending=1'),
        api.get('/chatbot/alerts').catch(() => ({ data: { data: [] } })),
      ]);
      setMessages(histRes.data.data ?? histRes.data ?? []);
      setReminders(remRes.data.data ?? remRes.data ?? []);
      setAlerts(alertRes.data.data ?? alertRes.data ?? []);
    } catch {}
  }, []);

  useEffect(() => { if (open) { loadData(); setUnread(0); } }, [open, loadData]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // ── Envoyer message ────────────────────────────────────────────────────
  async function send() {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await api.post('/chatbot/message', { message: text });
      const reply = res.data.data?.reply ?? res.data.reply ?? '';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: '❌ Erreur de connexion.' }]);
    } finally { setSending(false); }
  }

  // ── Actions rappels ────────────────────────────────────────────────────
  async function markDone(id: string) {
    await api.patch(`/chatbot/reminders/${id}/done`);
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  async function snooze(id: string) {
    await api.patch(`/chatbot/reminders/${id}/snooze`, { minutes: 30 });
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Rendu ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* Notifications flottantes */}
      <div className="fixed bottom-24 right-5 z-50 space-y-2 max-w-xs">
        {notifs.map((n, i) => (
          <div key={i} className="bg-white border border-orange-200 shadow-lg rounded-xl p-3 text-sm flex items-start gap-2 animate-in slide-in-from-right">
            <Bell size={14} className="text-orange-500 mt-0.5 shrink-0" />
            <p className="text-gray-700 flex-1">{n.message}</p>
            <button onClick={() => setNotifs((prev) => prev.filter((_, j) => j !== i))} className="text-gray-300 hover:text-gray-500">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-50 w-14 h-14 bg-primary-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-primary-700 transition-all hover:scale-105"
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Panel chat */}
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[360px] h-[520px] bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-primary-600 text-white px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <MessageCircle size={16} />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Assistant LNAYCRM</p>
              <p className="text-xs text-white/70">{alerts.length > 0 ? `${alerts.length} alerte${alerts.length > 1 ? 's' : ''}` : 'En ligne'}</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <ChevronDown size={18} />
            </button>
          </div>

          {/* Alertes qualité */}
          {alerts.length > 0 && (
            <div className="bg-amber-50 border-b border-amber-100 px-3 py-2 space-y-0.5">
              {alerts.slice(0, 2).map((a, i) => (
                <p key={i} className="text-xs text-amber-800">{a}</p>
              ))}
            </div>
          )}

          {/* Tabs */}
          <div className="flex border-b border-gray-100">
            {[
              { key: 'chat', label: 'Chat' },
              { key: 'reminders', label: `Rappels${reminders.length ? ` (${reminders.length})` : ''}` },
            ].map((t) => (
              <button key={t.key} onClick={() => setTab(t.key as any)}
                className={clsx('flex-1 py-2 text-xs font-medium transition-colors',
                  tab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-gray-400 hover:text-gray-600')}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 text-xs pt-8">
                    <MessageCircle size={32} className="mx-auto mb-2 text-gray-200" />
                    Bonjour ! Comment puis-je vous aider ?
                    <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                      {['Mes rappels', 'Alertes qualité', 'Résumé du jour'].map((s) => (
                        <button key={s} onClick={() => { setInput(s); }}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full text-xs hover:bg-gray-200 transition-colors">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={clsx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                    {m.role === 'system' ? (
                      <div className="w-full bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 text-xs text-orange-800">
                        {m.content}
                      </div>
                    ) : (
                      <div className={clsx(
                        'max-w-[80%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap',
                        m.role === 'user'
                          ? 'bg-primary-600 text-white rounded-br-sm'
                          : 'bg-gray-100 text-gray-800 rounded-bl-sm',
                      )}>
                        {m.content}
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-xl rounded-bl-sm px-3 py-2">
                      <Loader2 size={14} className="animate-spin text-gray-400" />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
              <div className="px-3 pb-3 pt-1 flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Posez votre question..."
                  className="flex-1 text-sm px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-primary-400 bg-gray-50"
                />
                <button onClick={send} disabled={!input.trim() || sending}
                  className="w-9 h-9 bg-primary-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-primary-700 transition-colors shrink-0">
                  <Send size={14} />
                </button>
              </div>
            </>
          )}

          {/* Reminders tab */}
          {tab === 'reminders' && (
            <div className="flex-1 overflow-y-auto">
              {reminders.length === 0 ? (
                <div className="text-center text-gray-400 text-xs pt-12">
                  <BellOff size={32} className="mx-auto mb-2 text-gray-200" />
                  Aucun rappel en attente
                </div>
              ) : (
                reminders.map((r) => (
                  <div key={r.id} className="px-3 py-3 border-b border-gray-50 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                        {r.client && (
                          <p className="text-xs text-gray-500">{r.client.firstName} {r.client.lastName} · {r.client.phone}</p>
                        )}
                        <p className="text-xs text-primary-600 mt-0.5 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(r.dueAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => snooze(r.id)}
                          title="Reporter 30 min"
                          className="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                          <Clock size={13} />
                        </button>
                        <button onClick={() => markDone(r.id)}
                          title="Marquer fait"
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                          <CheckCircle2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
