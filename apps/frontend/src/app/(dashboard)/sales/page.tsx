'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, Plus, TrendingUp, DollarSign, CheckCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { SaleFilters } from '@/components/sales/sale-filters';
import { SaleForm } from '@/components/sales/sale-form';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '@/stores/auth.store';

interface Sale {
  id: string; createdAt: string; status: string; amount: string | number;
  qualification: string; notes: string | null;
  agent: { firstName: string; lastName: string } | null;
  client: { firstName: string; lastName: string; company?: string | null } | null;
  campaign: { name: string } | null;
}

interface Stats { total: number; confirmed: number; todayTotal: number; revenue: number; confirmRate: number; }

const STATUS_STYLE: Record<string, string> = {
  PENDING:   'bg-yellow-100 text-yellow-700',
  CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
  REFUNDED:  'bg-gray-100 text-gray-500',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'En attente', CONFIRMED: 'Confirmée', CANCELLED: 'Annulée', REFUNDED: 'Remboursée',
};
const fmtEur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

type Filters = Parameters<typeof SaleFilters>[0]['value'];

const EMPTY_FILTERS: Filters = { agentId: '', campaignId: '', status: '', qualification: '', from: '', to: '', minAmount: '', maxAmount: '' };

export default function SalesPage() {
  const { user } = useAuthStore();
  const isAgent = user?.role === 'AGENT';

  const [sales,   setSales]   = useState<Sale[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [showNew, setShowNew] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const buildParams = useCallback((f: Filters) => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [salesRes, statsRes] = await Promise.allSettled([
        api.get(`/sales?${buildParams(filters)}&limit=100`),
        api.get('/sales/stats'),
      ]);
      if (salesRes.status === 'fulfilled') {
        setSales(salesRes.value.data?.data ?? []);
        setTotal(salesRes.value.data?.meta?.total ?? 0);
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data?.data ?? statsRes.value.data);
    } finally { setLoading(false); }
  }, [filters, buildParams]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    setSaving(true);
    try {
      await api.post('/sales', { ...data, amount: parseFloat(data.amount) });
      setShowNew(false);
      fetchData();
    } finally { setSaving(false); }
  };

  const exportFile = (fmt: 'xlsx' | 'docx') => {
    const url = `/api/v1/sales/export/${fmt}?${buildParams(filters)}`;
    window.open(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001'}${url}`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ventes</h1>
        <div className="flex gap-2">
          {!isAgent && (
            <>
              <button onClick={() => exportFile('xlsx')} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Download size={15} /> Excel
              </button>
              <button onClick={() => exportFile('docx')} className="btn-secondary flex items-center gap-1.5 text-sm">
                <Download size={15} /> Word
              </button>
            </>
          )}
          <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus size={15} /> Nouvelle vente
          </button>
        </div>
      </div>

      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total ventes',     value: stats.total,                         icon: TrendingUp,  color: 'bg-primary-500' },
            { label: 'Confirmées',       value: stats.confirmed,                     icon: CheckCircle, color: 'bg-green-500'   },
            { label: "Aujourd'hui",      value: stats.todayTotal,                    icon: Clock,       color: 'bg-blue-500'    },
            { label: 'Revenus confirmés',value: fmtEur(Number(stats.revenue ?? 0)), icon: DollarSign,  color: 'bg-emerald-500' },
          ].map((s) => (
            <div key={s.label} className="card p-4 flex items-center gap-3">
              <div className={clsx('p-2.5 rounded-xl', s.color)}>
                <s.icon size={18} className="text-white" />
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="card p-4">
        <SaleFilters value={filters} onChange={setFilters} isAgent={isAgent} />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">{total} vente(s)</span>
        </div>
        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Chargement…</div>
        ) : sales.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm">Aucune vente trouvée</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
              <tr>
                {['Date', 'Agent', 'Client', 'Campagne', 'Qualification', 'Montant', 'Statut', ''].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {s.agent ? `${s.agent.firstName} ${s.agent.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {s.client ? `${s.client.firstName} ${s.client.lastName}` : '—'}
                    {s.client?.company && <span className="text-gray-400 text-xs ml-1">({s.client.company})</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{s.campaign?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{s.qualification}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{fmtEur(parseFloat(String(s.amount)))}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[s.status])}>
                      {STATUS_LABEL[s.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/sales/${s.id}`} className="text-primary-600 hover:underline text-xs">Détail</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nouvelle vente */}
      <Dialog.Root open={showNew} onOpenChange={setShowNew}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">Nouvelle vente</Dialog.Title>
            <SaleForm onSubmit={handleCreate} onCancel={() => setShowNew(false)} loading={saving} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
