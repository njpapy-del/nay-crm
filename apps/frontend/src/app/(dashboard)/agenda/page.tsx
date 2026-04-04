'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, List } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { AppointmentModal } from '@/components/agenda/appointment-modal';
import { DispatchPanel } from '@/components/agenda/dispatch-panel';

interface Appointment {
  id: string; title: string; startAt: string; endAt: string; status: string; description?: string;
  agent: { id: string; firstName: string; lastName: string };
  client?: { firstName: string; lastName: string } | null;
  campaign?: { name: string } | null;
}

type ViewMode = 'month' | 'week' | 'day';

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 border-blue-300 text-blue-800',
  CONFIRMED:  'bg-green-100 border-green-300 text-green-800',
  CANCELLED:  'bg-red-100 border-red-300 text-red-600',
  DONE:       'bg-gray-100 border-gray-300 text-gray-600',
};
const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_NAMES   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const HOURS       = Array.from({ length: 12 }, (_, i) => i + 8); // 8h–19h

function toLocalDate(iso: string) { return new Date(iso); }
function sameDay(a: Date, b: Date) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function weekDays(baseDate: Date) { const d = new Date(baseDate); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return Array.from({ length: 7 }, (_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; }); }

export default function AgendaPage() {
  const now = new Date();
  const [cursor,   setCursor]   = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [view,     setView]     = useState<ViewMode>('month');
  const [appts,    setAppts]    = useState<Appointment[]>([]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [showNew,  setShowNew]  = useState(false);
  const [newDate,  setNewDate]  = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { from, to } = useMemo(() => {
    if (view === 'month') return { from: new Date(cursor.getFullYear(), cursor.getMonth(), 1).toISOString(), to: new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59).toISOString() };
    if (view === 'week')  { const days = weekDays(cursor); return { from: days[0].toISOString(), to: new Date(days[6].getTime() + 86399999).toISOString() }; }
    return { from: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()).toISOString(), to: new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 23, 59, 59).toISOString() };
  }, [cursor, view]);

  const fetchAppts = useCallback(async () => {
    const params = new URLSearchParams({ from, to, limit: '500' });
    if (filterAgent)  params.set('agentId', filterAgent);
    if (filterStatus) params.set('status',  filterStatus);
    const res = await api.get(`/agenda?${params}`);
    setAppts(res.data.data);
  }, [from, to, filterAgent, filterStatus]);

  useEffect(() => { fetchAppts(); }, [fetchAppts]);

  const navigate = (dir: -1 | 1) => {
    setCursor((c) => {
      const d = new Date(c);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      else if (view === 'week') d.setDate(d.getDate() + dir * 7);
      else d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const title = view === 'month'
    ? `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`
    : view === 'week'
    ? (() => { const w = weekDays(cursor); return `${w[0].toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })} – ${w[6].toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}`; })()
    : cursor.toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  const apptsByDay = useMemo(() => appts.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = toLocalDate(a.startAt).toDateString();
    acc[key] = [...(acc[key] ?? []), a];
    return acc;
  }, {}), [appts]);

  // ── Month View ────────────────────────────────────────────

  const renderMonth = () => {
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const firstDay    = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
    const todayStr    = now.toDateString();
    return (
      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {DAY_NAMES.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="h-28 border-r border-b border-gray-50 bg-gray-50/40" />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dateObj  = new Date(cursor.getFullYear(), cursor.getMonth(), day);
            const dayAppts = apptsByDay[dateObj.toDateString()] ?? [];
            const isToday  = dateObj.toDateString() === todayStr;
            return (
              <div key={day} onClick={() => { setNewDate(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}T09:00`); setShowNew(true); }}
                className="h-28 p-1.5 border-r border-b border-gray-100 hover:bg-gray-50 cursor-pointer overflow-hidden transition-colors">
                <span className={clsx('w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1', isToday ? 'bg-primary-600 text-white' : 'text-gray-700')}>
                  {day}
                </span>
                {dayAppts.slice(0, 3).map((a) => (
                  <div key={a.id} onClick={(e) => { e.stopPropagation(); setSelected(a); }}
                    className={clsx('text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border cursor-pointer', STATUS_STYLE[a.status])}>
                    {new Date(a.startAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })} {a.title}
                  </div>
                ))}
                {dayAppts.length > 3 && <div className="text-[10px] text-gray-400">+{dayAppts.length - 3}</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Week / Day View ───────────────────────────────────────

  const renderWeekDay = () => {
    const days = view === 'week' ? weekDays(cursor) : [cursor];
    return (
      <div className="card overflow-auto">
        <div className={clsx('grid border-b', view === 'week' ? 'grid-cols-[60px_repeat(7,1fr)]' : 'grid-cols-[60px_1fr]')}>
          <div />
          {days.map((d) => (
            <div key={d.toISOString()} className={clsx('py-2 text-center text-xs font-semibold border-l', sameDay(d, now) ? 'text-primary-600' : 'text-gray-500')}>
              {DAY_NAMES[(d.getDay() + 6) % 7]} {d.getDate()}
            </div>
          ))}
        </div>
        {HOURS.map((h) => (
          <div key={h} className={clsx('grid border-b border-gray-50', view === 'week' ? 'grid-cols-[60px_repeat(7,1fr)]' : 'grid-cols-[60px_1fr]')}>
            <div className="text-[10px] text-gray-400 py-2 pl-2 border-r">{h}:00</div>
            {days.map((d) => {
              const dayAppts = (apptsByDay[d.toDateString()] ?? []).filter((a) => new Date(a.startAt).getHours() === h);
              return (
                <div key={d.toISOString()} className="min-h-[48px] border-l p-0.5 hover:bg-gray-50/50">
                  {dayAppts.map((a) => (
                    <div key={a.id} onClick={() => setSelected(a)}
                      className={clsx('text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border cursor-pointer', STATUS_STYLE[a.status])}>
                      {a.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-lg">
            {(['month', 'week', 'day'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setView(v)}
                className={clsx('px-3 py-1 text-xs font-medium rounded-md transition-colors',
                  view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700')}>
                {v === 'month' ? 'Mois' : v === 'week' ? 'Semaine' : 'Jour'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { setNewDate(''); setShowNew(true); }} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus size={15} /> Nouveau RDV
        </button>
      </div>

      <div className="grid grid-cols-[1fr_240px] gap-4">
        <div className="space-y-3">
          {/* Navigation */}
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronLeft size={18} /></button>
            <span className="font-semibold text-gray-900 min-w-[200px] text-center capitalize">{title}</span>
            <button onClick={() => navigate(1)}  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><ChevronRight size={18} /></button>
            <button onClick={() => setCursor(new Date())} className="text-xs text-primary-600 hover:underline ml-2">Aujourd'hui</button>
            <div className="ml-auto flex gap-2">
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input-field text-xs h-8 w-32">
                <option value="">Tous statuts</option>
                {['SCHEDULED','CONFIRMED','CANCELLED','DONE'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          {view === 'month' ? renderMonth() : renderWeekDay()}
        </div>

        {/* Panneau latéral */}
        <div className="space-y-4">
          <DispatchPanel from={from} to={to} appointmentId={selected?.id} onDispatched={() => { fetchAppts(); setSelected(null); }} />

          {selected && (
            <div className="card p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">{selected.title}</h3>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
              </div>
              <span className={clsx('text-xs px-2 py-0.5 rounded-full border', STATUS_STYLE[selected.status])}>{selected.status}</span>
              <p className="text-xs text-gray-500">
                {new Date(selected.startAt).toLocaleString('fr-FR')} → {new Date(selected.endAt).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
              </p>
              {selected.agent && <p className="text-xs text-gray-600">Agent : {selected.agent.firstName} {selected.agent.lastName}</p>}
              {selected.client && <p className="text-xs text-gray-600">Client : {selected.client.firstName} {selected.client.lastName}</p>}
              {selected.campaign && <p className="text-xs text-gray-600">Campagne : {selected.campaign.name}</p>}
              {selected.description && <p className="text-xs text-gray-500 italic">{selected.description}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={() => { setShowNew(true); }} className="text-xs text-primary-600 hover:underline">Modifier</button>
                <button onClick={async () => { await api.delete(`/agenda/${selected.id}`); setSelected(null); fetchAppts(); }}
                  className="text-xs text-red-500 hover:underline">Supprimer</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <AppointmentModal
        open={showNew}
        onClose={() => { setShowNew(false); setSelected(null); }}
        onSaved={() => { setShowNew(false); setSelected(null); fetchAppts(); }}
        initial={selected ? { id: selected.id, title: selected.title, agentId: selected.agent?.id,
          startAt: selected.startAt.slice(0,16), endAt: selected.endAt.slice(0,16),
          status: selected.status, description: selected.description,
          campaignId: (selected.campaign as any)?.id, clientId: (selected.client as any)?.id,
        } : newDate ? { startAt: newDate, endAt: new Date(new Date(newDate).getTime() + 3600000).toISOString().slice(0,16) } : undefined}
      />
    </div>
  );
}
