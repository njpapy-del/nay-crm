'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FileText, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/status-badge';
import { PdfViewer } from '@/components/ui/pdf-viewer';

interface Quote {
  id: string;
  number: string;
  status: string;
  total: number;
  createdAt: string;
  validUntil?: string;
  client: { firstName: string; lastName: string; company?: string };
  invoice?: { id: string } | null;
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pdfFor, setPdfFor] = useState<Quote | null>(null);
  const [converting, setConverting] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotes?limit=50');
      setQuotes(res.data.data);
      setTotal(res.data.meta.total);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleConvert = async (id: string) => {
    if (!confirm('Convertir ce devis en facture ?')) return;
    setConverting(id);
    try {
      await api.post(`/quotes/${id}/convert`);
      fetch();
    } catch (e: any) {
      alert(e.message);
    } finally { setConverting(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devis</h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} devis au total</p>
        </div>
        <Link href="/quotes/new" className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouveau devis
        </Link>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Chargement...</div>
        ) : quotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">Aucun devis</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Numéro', 'Client', 'Statut', 'Total TTC', 'Validité', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-primary-600">{q.number}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{q.client.firstName} {q.client.lastName}</div>
                      {q.client.company && <div className="text-xs text-gray-400">{q.client.company}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={q.status} type="quote" /></td>
                    <td className="px-4 py-3 font-medium">{fmt(q.total)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {q.validUntil ? new Date(q.validUntil).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setPdfFor(q)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600" title="PDF">
                          <FileText size={15} />
                        </button>
                        {!q.invoice && (
                          <button onClick={() => handleConvert(q.id)} disabled={converting === q.id}
                            className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600" title="Convertir en facture">
                            {converting === q.id ? '…' : <ArrowRight size={15} />}
                          </button>
                        )}
                        {q.invoice && <span className="text-xs text-green-600 font-medium">Facturé</span>}
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
          endpoint={`/quotes/${pdfFor.id}/pdf`}
          filename={`devis-${pdfFor.number}.pdf`}
          onClose={() => setPdfFor(null)}
        />
      )}
    </div>
  );
}
