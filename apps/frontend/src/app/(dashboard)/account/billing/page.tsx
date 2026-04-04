'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Download, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const STATUS_ICONS: Record<string, any> = {
  PAID:  CheckCircle2,
  DRAFT: Clock,
  FAILED: XCircle,
};
const STATUS_COLORS: Record<string, string> = {
  PAID:  'text-green-600 bg-green-50',
  DRAFT: 'text-gray-500 bg-gray-50',
  FAILED: 'text-red-600 bg-red-50',
};

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/subscriptions/me/invoices');
      setInvoices(res.data.data ?? res.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Facturation</h1>
        <p className="text-sm text-gray-500 mt-0.5">Historique de vos factures</p>
      </div>

      <div className="card overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Aucune facture disponible</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Période', 'Montant', 'Statut', ''].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.map((inv: any) => {
                const Icon = STATUS_ICONS[inv.status] ?? Clock;
                return (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(inv.createdAt).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {new Date(inv.periodStart).toLocaleDateString('fr-FR')} →{' '}
                      {new Date(inv.periodEnd).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900">
                      {inv.amount.toLocaleString('fr-FR')} {inv.currency}
                    </td>
                    <td className="px-5 py-3">
                      <span className={clsx('text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 w-fit', STATUS_COLORS[inv.status])}>
                        <Icon size={11} /> {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {inv.stripeInvoiceId && (
                        <button className="text-gray-400 hover:text-gray-600 transition-colors">
                          <Download size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
