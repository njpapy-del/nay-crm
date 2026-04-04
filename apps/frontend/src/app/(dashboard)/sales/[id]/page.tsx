'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Mic, Phone, Pencil, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { SaleForm } from '@/components/sales/sale-form';
import * as Dialog from '@radix-ui/react-dialog';

interface SaleDetail {
  id: string; createdAt: string; status: string; amount: string | number;
  qualification: string; notes: string | null; closedAt: string | null;
  agent:    { id: string; firstName: string; lastName: string } | null;
  client:   { id: string; firstName: string; lastName: string; company?: string | null } | null;
  campaign: { id: string; name: string } | null;
  call: {
    id: string; callerNumber: string; calleeNumber: string; duration: number | null; startedAt: string;
    recording: { id: string; filePath: string; durationSec: number } | null;
  } | null;
  logs: {
    id: string; field: string; oldValue: string | null; newValue: string | null; createdAt: string;
    user: { firstName: string; lastName: string };
  }[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700', CONFIRMED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',    REFUNDED:  'bg-gray-100 text-gray-500',
};
const fmtEur = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);
const fmtDur = (s: number | null) => { if (!s) return '—'; const m = Math.floor(s / 60); return m > 0 ? `${m}m ${s % 60}s` : `${s}s`; };

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();
  const [sale,    setSale]    = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try { setSale((await api.get(`/sales/${id}`)).data); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleUpdate = async (data: any) => {
    setSaving(true);
    try {
      await api.patch(`/sales/${id}`, { ...data, amount: parseFloat(data.amount) });
      setEditing(false);
      fetch();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Supprimer cette vente ?')) return;
    await api.delete(`/sales/${id}`);
    router.push('/sales');
  };

  if (loading) return <div className="py-20 text-center text-gray-400">Chargement…</div>;
  if (!sale)   return <div className="py-20 text-center text-gray-400">Vente introuvable</div>;

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft size={16} /> Retour
        </button>
        <div className="flex gap-2">
          <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Pencil size={14} /> Modifier
          </button>
          <button onClick={handleDelete} className="btn-danger flex items-center gap-1.5 text-sm">
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      </div>

      {/* Infos vente */}
      <div className="card p-6 grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <h1 className="text-xl font-bold text-gray-900">Vente #{sale.id.slice(-8)}</h1>
          <dl className="space-y-2">
            {[
              ['Agent',      sale.agent    ? `${sale.agent.firstName} ${sale.agent.lastName}` : '—'],
              ['Client',     sale.client   ? `${sale.client.firstName} ${sale.client.lastName}${sale.client.company ? ` (${sale.client.company})` : ''}` : '—'],
              ['Campagne',   sale.campaign?.name ?? '—'],
              ['Qualification', sale.qualification],
              ['Date',       new Date(sale.createdAt).toLocaleDateString('fr-FR')],
              ['Clôture',    sale.closedAt ? new Date(sale.closedAt).toLocaleDateString('fr-FR') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <dt className="w-28 text-xs font-semibold text-gray-500 uppercase shrink-0">{k}</dt>
                <dd className="text-sm text-gray-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex flex-col gap-4">
          <div className="text-center p-6 bg-emerald-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">Montant</p>
            <p className="text-3xl font-bold text-emerald-700">{fmtEur(parseFloat(String(sale.amount)))}</p>
            <span className={clsx('mt-2 inline-block px-3 py-0.5 rounded-full text-xs font-medium', STATUS_STYLE[sale.status])}>
              {sale.status}
            </span>
          </div>
          {sale.notes && (
            <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 italic">{sale.notes}</div>
          )}
        </div>
      </div>

      {/* Appel lié */}
      {sale.call && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Phone size={16} className="text-primary-500" /> Appel lié
          </h2>
          <div className="flex items-center gap-6 text-sm text-gray-700">
            <span>{sale.call.callerNumber} → {sale.call.calleeNumber}</span>
            <span className="text-gray-400">{fmtDur(sale.call.duration)}</span>
            <span className="text-gray-400">{new Date(sale.call.startedAt).toLocaleString('fr-FR')}</span>
          </div>
          {sale.call.recording && (
            <div className="mt-3 flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Mic size={16} className="text-blue-500" />
              <span className="text-sm text-blue-700">Enregistrement ({fmtDur(sale.call.recording.durationSec)})</span>
              <a href={sale.call.recording.filePath} target="_blank" rel="noreferrer"
                className="ml-auto text-xs text-blue-600 hover:underline">Écouter / Télécharger</a>
            </div>
          )}
        </div>
      )}

      {/* Journal modifications */}
      {sale.logs.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3">Journal des modifications</h2>
          <div className="space-y-2">
            {sale.logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-gray-50">
                <span className="text-gray-400 w-32 shrink-0">{new Date(log.createdAt).toLocaleString('fr-FR')}</span>
                <span className="font-medium text-gray-700">{log.user.firstName} {log.user.lastName}</span>
                <span className="text-gray-500">a modifié <span className="font-mono text-gray-700">{log.field}</span></span>
                <span className="text-red-400 line-through">{log.oldValue || '—'}</span>
                <span className="text-gray-400">→</span>
                <span className="text-green-600">{log.newValue || '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal édition */}
      <Dialog.Root open={editing} onOpenChange={setEditing}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">Modifier la vente</Dialog.Title>
            <SaleForm
              initial={{ agentId: sale.agent?.id ?? '', clientId: sale.client?.id ?? '', campaignId: sale.campaign?.id ?? '',
                         status: sale.status, amount: String(sale.amount), qualification: sale.qualification, notes: sale.notes ?? '' }}
              onSubmit={handleUpdate} onCancel={() => setEditing(false)} loading={saving}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
