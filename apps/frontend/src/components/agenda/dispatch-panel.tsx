'use client';

import { useCallback, useEffect, useState } from 'react';
import { Zap, Users } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface AgentLoad { id: string; firstName: string; lastName: string; appointmentCount: number; }

interface Props { from: string; to: string; appointmentId?: string; onDispatched?: () => void; }

export function DispatchPanel({ from, to, appointmentId, onDispatched }: Props) {
  const [workload,    setWorkload]    = useState<AgentLoad[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [loading,     setLoading]     = useState(false);

  const loadWorkload = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const res = await api.get(`/agenda/workload?from=${from}&to=${to}`);
      const payload = res.data;
      setWorkload(Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { loadWorkload(); }, [loadWorkload]);

  const maxCount = Math.max(...workload.map((a) => a.appointmentCount), 1);

  const handleDispatch = async () => {
    if (!appointmentId) return;
    setDispatching(true);
    try {
      await api.post(`/agenda/${appointmentId}/dispatch`);
      loadWorkload();
      onDispatched?.();
    } finally { setDispatching(false); }
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Users size={16} className="text-primary-500" />
        <h3 className="font-semibold text-gray-900 text-sm">Charge agents</h3>
        {loading && <span className="text-xs text-gray-400">Chargement…</span>}
      </div>

      <div className="space-y-2">
        {workload.map((a) => {
          const pct = Math.round((a.appointmentCount / maxCount) * 100);
          return (
            <div key={a.id}>
              <div className="flex justify-between text-xs mb-0.5">
                <span className="text-gray-700">{a.firstName} {a.lastName}</span>
                <span className="text-gray-400">{a.appointmentCount} RDV</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={clsx('h-full rounded-full transition-all',
                  pct < 40 ? 'bg-green-400' : pct < 70 ? 'bg-yellow-400' : 'bg-red-400')}
                  style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {workload.length === 0 && !loading && (
          <p className="text-xs text-gray-400 text-center py-2">Aucun agent disponible</p>
        )}
      </div>

      {appointmentId && (
        <button onClick={handleDispatch} disabled={dispatching}
          className="w-full btn-primary text-sm flex items-center justify-center gap-2 mt-1">
          <Zap size={14} /> {dispatching ? 'Assignation…' : 'Assigner automatiquement'}
        </button>
      )}
    </div>
  );
}
