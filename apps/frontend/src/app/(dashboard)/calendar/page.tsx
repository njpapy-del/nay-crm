'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { AppointmentForm } from '@/components/calendar/appointment-form';
import { clsx } from 'clsx';

interface Appointment {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  agent: { firstName: string; lastName: string };
  lead?: { firstName: string; lastName: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 border-blue-300 text-blue-800',
  CONFIRMED:  'bg-green-100 border-green-300 text-green-800',
  CANCELLED:  'bg-red-100 border-red-300 text-red-600',
  DONE:       'bg-gray-100 border-gray-300 text-gray-600',
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7; // Monday=0
}

const MONTH_NAMES = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const DAY_NAMES   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];

export default function CalendarPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    const from = new Date(year, month, 1).toISOString();
    const to   = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    try {
      const res = await api.get(`/appointments?from=${from}&to=${to}`);
      setAppointments(res.data?.data ?? res.data ?? []);
    } catch (e: any) { console.error('[calendar]', e?.message); }
  }, [year, month]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  const prevMonth = () => { setMonth((m) => m === 0 ? (setYear((y) => y - 1), 11) : m - 1); };
  const nextMonth = () => { setMonth((m) => m === 11 ? (setYear((y) => y + 1), 0) : m + 1); };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const apptByDay = appointments.reduce<Record<number, Appointment[]>>((acc, appt) => {
    const d = new Date(appt.startAt).getDate();
    acc[d] = [...(acc[d] ?? []), appt];
    return acc;
  }, {});

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setSelectedDate(dateStr);
    setShowForm(true);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronLeft size={18} /></button>
            <span className="text-base font-semibold text-gray-800 w-40 text-center">{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600"><ChevronRight size={18} /></button>
          </div>
        </div>
        <button onClick={() => { setSelectedDate(null); setShowForm(true); }}
          className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Rendez-vous
        </button>
      </div>

      {/* Grid */}
      <div className="card overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-2 text-xs font-semibold text-gray-500 text-center">{d}</div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {/* Empty cells before first day */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`e-${i}`} className="min-h-[96px] border-b border-r border-gray-100 bg-gray-50/50" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isToday = dateStr === todayStr;
            const dayAppts = apptByDay[day] ?? [];

            return (
              <div key={day}
                onClick={() => handleDayClick(day)}
                className={clsx(
                  'min-h-[96px] border-b border-r border-gray-100 p-1.5 cursor-pointer hover:bg-primary-50/30 transition-colors',
                  (firstDay + i) % 7 === 6 && 'border-r-0',
                )}>
                <span className={clsx('text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  isToday ? 'bg-primary-600 text-white' : 'text-gray-700')}>
                  {day}
                </span>
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 3).map((appt) => (
                    <div key={appt.id}
                      className={clsx('text-xs px-1 py-0.5 rounded border truncate', STATUS_COLORS[appt.status])}
                      title={`${appt.title} — ${appt.agent.firstName} ${appt.agent.lastName}`}>
                      <span className="flex items-center gap-0.5">
                        <Clock size={9} className="shrink-0" />
                        {new Date(appt.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {' '}{appt.title}
                      </span>
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <p className="text-xs text-gray-400 pl-1">+{dayAppts.length - 3} autres</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming appointments list */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Rendez-vous du mois ({appointments.length})</h3>
        {appointments.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun rendez-vous ce mois-ci</p>
        ) : (
          <div className="space-y-2">
            {appointments.map((appt) => (
              <div key={appt.id} className="flex items-center gap-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                <div className={clsx('w-2 h-2 rounded-full shrink-0', {
                  'bg-blue-500': appt.status === 'SCHEDULED',
                  'bg-green-500': appt.status === 'CONFIRMED' || appt.status === 'DONE',
                  'bg-red-400': appt.status === 'CANCELLED',
                })} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{appt.title}</p>
                  <p className="text-xs text-gray-500">{appt.agent.firstName} {appt.agent.lastName}</p>
                </div>
                <div className="text-xs text-gray-500 shrink-0">
                  {new Date(appt.startAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  {' '}
                  {new Date(appt.startAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AppointmentForm
          defaultDate={selectedDate ?? undefined}
          onClose={() => setShowForm(false)}
          onSaved={fetchAppointments}
        />
      )}
    </div>
  );
}
