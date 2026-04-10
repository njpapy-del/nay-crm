'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { clsx } from 'clsx';

interface Attendance {
  id: string; date: string; hoursWorked: number; minutesProductive: number; isPresent: boolean; notes?: string;
  agent: { firstName: string; lastName: string };
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/hr/attendance?from=${from}&to=${to}`);
      setAttendance(r.data?.data ?? []);
    } finally { setLoading(false); }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const totalH = attendance.reduce((s, a) => s + a.hoursWorked, 0);
  const presentCount = attendance.filter(a => a.isPresent).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Suivi des présences</h1>
          <p className="text-sm text-gray-500 mt-0.5">{attendance.length} entrée(s)</p>
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center">
            <Clock size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{totalH.toFixed(1)}h</p>
            <p className="text-xs text-gray-500">Total heures</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-green-500 rounded-lg flex items-center justify-center">
            <CheckCircle size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{presentCount}</p>
            <p className="text-xs text-gray-500">Jours présents</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-9 h-9 bg-red-400 rounded-lg flex items-center justify-center">
            <XCircle size={16} className="text-white" />
          </div>
          <div>
            <p className="text-xl font-bold text-gray-900">{attendance.length - presentCount}</p>
            <p className="text-xs text-gray-500">Jours absents</p>
          </div>
        </div>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : attendance.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune donnée de présence</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Agent</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Présent</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Heures</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Productif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {attendance.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{a.agent.firstName} {a.agent.lastName}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(a.date).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-3">
                    {a.isPresent
                      ? <CheckCircle size={16} className="text-green-500" />
                      : <XCircle size={16} className="text-red-400" />}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.hoursWorked}h</td>
                  <td className="px-4 py-3 text-gray-500">{a.minutesProductive}min</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
