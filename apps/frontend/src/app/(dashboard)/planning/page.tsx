'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';
import { Plus, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'BREAK' | 'TOILET' | 'LUNCH' | 'TRAINING' | 'ABSENCE' | 'MEETING';
type ReqStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

interface PlanEvent {
  id: string;
  agentId: string;
  type: EventType;
  title: string;
  startAt: string;
  endAt: string;
  notes?: string;
  agent: { firstName: string; lastName: string };
}

interface PlanRequest {
  id: string;
  agentId: string;
  type: EventType;
  title: string;
  startAt: string;
  endAt: string;
  motif?: string;
  status: ReqStatus;
  agent: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string };
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<EventType, { label: string; icon: string; color: string; bg: string }> = {
  BREAK:    { label: 'Pause',           icon: '☕', color: 'text-amber-700',  bg: 'bg-amber-100'   },
  TOILET:   { label: 'Pause toilette',  icon: '🚻', color: 'text-purple-700', bg: 'bg-purple-100'  },
  LUNCH:    { label: 'Déjeuner',        icon: '🍽️', color: 'text-orange-700', bg: 'bg-orange-100'  },
  TRAINING: { label: 'Formation',       icon: '📚', color: 'text-teal-700',   bg: 'bg-teal-100'    },
  ABSENCE:  { label: 'Absence',         icon: '🏠', color: 'text-red-700',    bg: 'bg-red-100'     },
  MEETING:  { label: 'Réunion',         icon: '👥', color: 'text-blue-700',   bg: 'bg-blue-100'    },
};

const STATUS_STYLE: Record<ReqStatus, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  APPROVED:  'bg-green-100 text-green-700',
  REJECTED:  'bg-red-100 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<ReqStatus, string> = {
  PENDING: 'En attente', APPROVED: 'Approuvée', REJECTED: 'Refusée', CANCELLED: 'Annulée',
};

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const startOfWeek = (d: Date) => {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
};

const addDays = (d: Date, n: number) => {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
};

const fmtDate = (d: Date) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
const fmtTime = (s: string) => new Date(s).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

// Combine date string (YYYY-MM-DD) + time string (HH:MM) into ISO
const buildISO = (date: string, time: string) => {
  if (!date || !time) return '';
  return new Date(`${date}T${time}:00`).toISOString();
};

// ─── New request form ─────────────────────────────────────────────────────────

function RequestForm({ onSubmit, onCancel }: { onSubmit: (d: any) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    type:      'BREAK' as EventType,
    date:      '',
    startTime: '',
    endTime:   '',
    motif:     '',
  });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const canSubmit = form.date && form.startTime && form.endTime;

  const handleSubmit = () => {
    const title   = TYPE_META[form.type].label;
    const startAt = buildISO(form.date, form.startTime);
    const endAt   = buildISO(form.date, form.endTime);
    onSubmit({ type: form.type, title, startAt, endAt, motif: form.motif });
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md space-y-4">
      <h2 className="text-lg font-bold text-gray-900">Nouvelle demande planning</h2>

      {/* Type */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Type de demande *</label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(TYPE_META) as EventType[]).map(t => {
            const m = TYPE_META[t];
            return (
              <button key={t} type="button" onClick={() => set('type', t)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                  form.type === t
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <span className="text-lg">{m.icon}</span>
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Date *</label>
        <input
          type="date"
          className="input w-full"
          value={form.date}
          onChange={e => set('date', e.target.value)}
        />
      </div>

      {/* Plage horaire */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Plage horaire *</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Début</label>
            <input
              type="time"
              className="input w-full"
              value={form.startTime}
              onChange={e => set('startTime', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Fin</label>
            <input
              type="time"
              className="input w-full"
              value={form.endTime}
              onChange={e => set('endTime', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Motif */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase">Motif</label>
        <textarea
          className="input w-full resize-none"
          rows={2}
          value={form.motif}
          onChange={e => set('motif', e.target.value)}
          placeholder="Raison de la demande…"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-sm">Annuler</button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Envoyer
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { user } = useAuthStore();
  const isReviewer = ['ADMIN', 'MANAGER', 'HR'].includes(user?.role ?? '');

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [events,    setEvents]    = useState<PlanEvent[]>([]);
  const [requests,  setRequests]  = useState<PlanRequest[]>([]);
  const [showForm,  setShowForm]  = useState(false);
  const [loading,   setLoading]   = useState(true);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd  = addDays(weekStart, 6);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const from = weekStart.toISOString();
    const to   = weekEnd.toISOString();
    const toArr = (r: any) => {
      const d = r?.data?.data ?? r?.data;
      return Array.isArray(d) ? d : [];
    };
    try {
      await Promise.allSettled([
        api.get(`/planning/events?from=${from}&to=${to}`).then(r => setEvents(toArr(r))),
        isReviewer
          ? api.get('/planning/requests?status=PENDING').then(r => setRequests(toArr(r)))
          : api.get('/planning/requests/mine').then(r => setRequests(toArr(r))),
      ]);
    } catch (e: any) {
      console.error('[planning]', e?.message);
    } finally {
      setLoading(false);
    }
  }, [weekStart, isReviewer]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRequest = async (data: any) => {
    await api.post('/planning/requests', data);
    setShowForm(false);
    fetchData();
  };

  const reviewRequest = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    await api.post(`/planning/requests/${id}/review`, { status });
    fetchData();
  };

  const eventsOnDay = (day: Date) => events.filter(e => {
    const d = new Date(e.startAt);
    return d.toDateString() === day.toDateString();
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planning équipe</h1>
          <p className="text-gray-500 text-sm mt-0.5">Agenda partagé</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> Demande
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button onClick={() => setWeekStart(w => addDays(w, -7))} className="p-1.5 rounded-lg border hover:bg-gray-50">
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {fmtDate(weekStart)} — {fmtDate(weekEnd)}
        </span>
        <button onClick={() => setWeekStart(w => addDays(w, 7))} className="p-1.5 rounded-lg border hover:bg-gray-50">
          <ChevronRight size={16} />
        </button>
        <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn-secondary text-xs py-1">
          Aujourd'hui
        </button>
      </div>

      {/* Week calendar grid */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((day, i) => {
            const isToday = day.toDateString() === new Date().toDateString();
            return (
              <div key={i} className={clsx('py-2 px-1 text-center border-r last:border-r-0 border-gray-100', isToday && 'bg-primary-50')}>
                <p className="text-xs text-gray-500 font-medium">{DAYS[i]}</p>
                <p className={clsx('text-sm font-bold mt-0.5', isToday ? 'text-primary-700' : 'text-gray-900')}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>
        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Chargement…</div>
        ) : (
          <div className="grid grid-cols-7 min-h-[160px]">
            {weekDays.map((day, i) => {
              const dayEvents = eventsOnDay(day);
              return (
                <div key={i} className="border-r last:border-r-0 border-gray-100 p-1.5 space-y-1">
                  {dayEvents.map(e => {
                    const m = TYPE_META[e.type] ?? TYPE_META.BREAK;
                    return (
                      <div key={e.id} className={clsx('rounded-lg px-2 py-1 text-xs font-medium', m.bg, m.color)}>
                        <div className="font-semibold truncate">{m.icon} {e.title}</div>
                        <div className="opacity-70 truncate">{e.agent.firstName} {e.agent.lastName}</div>
                        <div className="opacity-60 font-mono">{fmtTime(e.startAt)}–{fmtTime(e.endAt)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending requests (manager/HR) or my requests (agent) */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 font-semibold text-gray-700 text-sm">
          {isReviewer ? `Demandes en attente (${requests.filter(r => r.status === 'PENDING').length})` : 'Mes demandes'}
        </div>
        {requests.length === 0 ? (
          <div className="py-8 text-center text-gray-400 text-sm">Aucune demande</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Agent', 'Type', 'Date', 'Plage horaire', 'Motif', 'Statut', ...(isReviewer ? ['Actions'] : [])].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map(req => {
                const m = TYPE_META[req.type] ?? TYPE_META.BREAK;
                return (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {req.agent.firstName} {req.agent.lastName}
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', m.bg, m.color)}>
                        {m.icon} {m.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {new Date(req.startAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono whitespace-nowrap">
                      {fmtTime(req.startAt)} → {fmtTime(req.endAt)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs max-w-[140px] truncate">{req.motif ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[req.status])}>
                        {STATUS_LABEL[req.status]}
                      </span>
                    </td>
                    {isReviewer && req.status === 'PENDING' && (
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={() => reviewRequest(req.id, 'APPROVED')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                            <Check size={12} /> Approuver
                          </button>
                          <button onClick={() => reviewRequest(req.id, 'REJECTED')}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 text-red-600 rounded-lg hover:bg-red-200">
                            <X size={12} /> Refuser
                          </button>
                        </div>
                      </td>
                    )}
                    {isReviewer && req.status !== 'PENDING' && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Request form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowForm(false)} />
          <div className="relative z-10">
            <RequestForm onSubmit={handleRequest} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
