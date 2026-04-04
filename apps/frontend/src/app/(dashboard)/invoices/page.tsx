'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, CheckCircle, Filter } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { PdfViewer } from '@/components/ui/pdf-viewer';

interface Invoice {
  id: string;
  number: string;
  status: string;
  total: number;
  dueDate?: string;
  paidAt?: string;
  createdAt: string;
  client: { firstName: string; lastName: string; company?: string };
  quote?: { number: string } | null;
}

const STATUSES = [
  { value: '', label: 'Tous' },
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'SENT', label: 'Envoyée' },
  { value: 'PAID', label: 'Payée' },
  { value: 'OVERDUE', label: 'En retard' },
  { value: 'CANCELLED', label: 'Annulée' },
];

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<{ totalRevenue: number; byStatus: { status: string; amount: number; count: number }[] } | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfFor, setPdfFor] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (statusFilter) params.set('status', statusFilter);
      const [invRes, statRes] = await Promise.all([
        api.get(`/invoices?${params}`),
        api.get('/invoices/stats'),
      ]);
      setInvoices(invRes.data.data);
      setTotal(invRes.data.meta.total);
      setStats(statRes.data.data);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetch(); }, [fetch]);

  const markPaid = async (id: string) => {
    if (!confirm('Marquer cette facture comme payée ?')) return;
    setPaying(id);
    try { await api.patch(`/invoices/${id}/pay`); fetch(); }
    finally { setPaying(null); }
  };

  const paidTotal = stats?.byStatus.find((s) => s.status === 'PAID')?.amount ?? 0;
  const pendingTotal = stats?.byStatus.filter((s) => ['SENT', 'OVERDUE'].includes(s.status)).reduce((a, s) => a + s.amount, 0) ?? 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Factures</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} factures</p>
        </div>
      </div>

      {/* Stats rapides */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Chiffre d\'affaires', value: fmt(stats.totalRevenue), color: 'text-gray-900' },
            { label: 'Encaissé', value: fmt(paidTotal), color: 'text-green-600' },
            { label: 'À encaisser', value: fmt(pendingTotal), color: 'text-orange-600' },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres + table */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <div className="flex gap-2">
            {STATUSES.map((s) => (
              <button key={s.value} onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucune facture</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Numéro', 'Client', 'Devis', 'Statut', 'Total TTC', 'Échéance', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono font-medium text-primary-600">{inv.number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{inv.client.firstName} {inv.client.lastName}</div>
                      {inv.client.company && <div className="text-xs text-gray-400">{inv.client.company}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{inv.quote?.number ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={inv.status} type="invoice" /></td>
                    <td className="px-4 py-3 font-medium">{fmt(inv.total)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPdfFor(inv)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600" title="PDF">
                          <FileText size={15} />
                        </button>
                        {inv.status !== 'PAID' && inv.status !== 'CANCELLED' && (
                          <button onClick={() => markPaid(inv.id)} disabled={paying === inv.id}
                            className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600" title="Marquer payée">
                            {paying === inv.id ? '…' : <CheckCircle size={15} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pdfFor && (
        <PdfViewer
          endpoint={`/invoices/${pdfFor.id}/pdf`}
          filename={`facture-${pdfFor.number}.pdf`}
          onClose={() => setPdfFor(null)}
        />
      )}
    </div>
  );
}
