'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Calendar } from 'lucide-react';
import { clsx } from 'clsx';

type ReqType = 'ABSENCE' | 'FORMATION' | 'CONGE';

interface AgendaItem {
  id: string; type: ReqType; startDate: string; endDate: string; comment?: string;
  agent: { firstName: string; lastName: string };
}

const TYPE_STYLES: Record<ReqType, string> = {
  ABSENCE: 'bg-red-100 text-red-700',
  FORMATION: 'bg-blue-100 text-blue-700',
  CONGE: 'bg-green-100 text-green-700',
};
const TYPE_LABELS: Record<ReqType, string> = { ABSENCE: 'Absence', FORMATION: 'Formation', CONGE: 'Congé' };

export default function HrAgendaPage() {
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/hr/agenda?from=${from}&to=${to}`);
      setItems(r.data?.data ?? []);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda RH</h1>
          <p className="text-sm text-gray-500 mt-0.5">Absences et formations planifiées</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
          <label className="text-xs text-gray-500">Au</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5" />
        </div>
      </div>

      {/* Légende */}
      <div className="flex gap-3 flex-wrap">
        {(Object.keys(TYPE_LABELS) as ReqType[]).map(t => (
          <span key={t} className={clsx('px-2.5 py-1 rounded-full text-xs font-medium', TYPE_STYLES[t])}>
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : items.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Calendar size={40} className="mx-auto mb-2 text-gray-200" />
          <p>Aucun événement sur cette période</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="card p-4 flex items-center gap-4">
              <span className={clsx('px-2.5 py-1 rounded-full text-xs font-bold shrink-0', TYPE_STYLES[item.type])}>
                {TYPE_LABELS[item.type]}
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{item.agent.firstName} {item.agent.lastName}</p>
                {item.comment && <p className="text-xs text-gray-400 italic">{item.comment}</p>}
              </div>
              <div className="text-right text-xs text-gray-500 shrink-0">
                <p>{new Date(item.startDate).toLocaleDateString('fr-FR')}</p>
                <p>→ {new Date(item.endDate).toLocaleDateString('fr-FR')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
