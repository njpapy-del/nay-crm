'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { Users, Calendar, Clock, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Dashboard {
  period: { from: string; to: string };
  agents: number;
  requests: { total: number; PENDING: number; APPROVED: number; REJECTED: number; byType: Record<string, number> };
  attendance: { totalHours: number; presentDays: number };
}

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', color)}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function HrDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    const from = new Date(Date.now() - +period * 86400000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    setLoading(true);
    api.get(`/hr/dashboard?from=${from}&to=${to}`)
      .then(r => setData(r.data?.data ?? r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard RH</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des présences et demandes</p>
        </div>
        <div className="flex items-center gap-2">
          {['7', '30', '90'].map(d => (
            <button key={d} onClick={() => setPeriod(d)}
              className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                period === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {d}j
            </button>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { href: '/hr/requests', label: 'Demandes', icon: FileText, color: 'bg-blue-500' },
          { href: '/hr/attendance', label: 'Présences', icon: Clock, color: 'bg-green-500' },
          { href: '/hr/agenda', label: 'Agenda RH', icon: Calendar, color: 'bg-purple-500' },
        ].map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href} className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow">
            <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', color)}>
              <Icon size={16} className="text-white" />
            </div>
            <span className="text-sm font-medium text-gray-700">{label}</span>
          </Link>
        ))}
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Agents" value={data.agents} icon={Users} color="bg-gray-500" />
            <StatCard label="Demandes" value={data.requests.total} sub={`${data.requests.PENDING} en attente`} icon={FileText} color="bg-blue-500" />
            <StatCard label="Heures travaillées" value={`${data.attendance.totalHours}h`} icon={Clock} color="bg-green-500" />
            <StatCard label="Jours présents" value={data.attendance.presentDays} icon={Calendar} color="bg-purple-500" />
          </div>

          {/* Statuts demandes */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Statuts des demandes</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <AlertCircle size={20} className="text-yellow-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.requests.PENDING}</p>
                <p className="text-xs text-gray-500">En attente</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <CheckCircle size={20} className="text-green-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.requests.APPROVED}</p>
                <p className="text-xs text-gray-500">Acceptées</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center">
                  <XCircle size={20} className="text-red-500" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{data.requests.REJECTED}</p>
                <p className="text-xs text-gray-500">Refusées</p>
              </div>
            </div>
          </div>

          {/* Par type */}
          {Object.keys(data.requests.byType).length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">Répartition par type</h2>
              <div className="flex gap-4">
                {Object.entries(data.requests.byType).map(([type, count]) => (
                  <div key={type} className="text-center">
                    <p className="text-xl font-bold text-gray-900">{count}</p>
                    <p className="text-xs text-gray-500 capitalize">{type.toLowerCase()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
