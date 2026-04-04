'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';
import { QuoteLineEditor } from '@/components/quotes/quote-line-editor';

const schema = z.object({
  clientId:   z.string().min(1, 'Sélectionner un client'),
  validUntil: z.string().optional(),
  notes:      z.string().optional(),
  lines: z.array(z.object({
    description: z.string().min(1, 'Requis'),
    quantity:    z.number().min(0.001),
    unitPrice:   z.number().min(0),
    taxRate:     z.number().min(0).max(100),
  })).min(1, 'Au moins une ligne requise'),
});
type FormData = z.infer<typeof schema>;

interface Client { id: string; firstName: string; lastName: string; company?: string; }

function useTotals(lines: FormData['lines'] = []) {
  const subtotal = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0), 0);
  const taxAmount = lines.reduce((s, l) => s + (l.quantity || 0) * (l.unitPrice || 0) * ((l.taxRate || 0) / 100), 0);
  return { subtotal, taxAmount, total: subtotal + taxAmount };
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n);

export default function NewQuotePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    api.get('/clients?limit=100').then((r) => setClients(r.data.data));
  }, []);

  const { register, control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { lines: [{ description: '', quantity: 1, unitPrice: 0, taxRate: 20 }] },
  });

  const lines = watch('lines') ?? [];
  const { subtotal, taxAmount, total } = useTotals(lines);

  const onSubmit = async (data: FormData) => {
    await api.post('/quotes', data);
    router.push('/quotes');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nouveau devis</h1>
        <p className="text-gray-500 text-sm mt-0.5">Remplissez les informations du devis</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Infos générales */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Informations générales</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client *</label>
              <select {...register('clientId')} className="input-field">
                <option value="">Sélectionner un client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ''}
                  </option>
                ))}
              </select>
              {errors.clientId && <p className="text-red-500 text-xs mt-1">{errors.clientId.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Valide jusqu&apos;au</label>
              <input {...register('validUntil')} type="date" className="input-field" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} className="input-field resize-none" rows={2} />
          </div>
        </div>

        {/* Lignes */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Lignes du devis</h2>
          <QuoteLineEditor control={control as any} register={register} />
          {errors.lines?.root && <p className="text-red-500 text-xs">{errors.lines.root.message}</p>}
        </div>

        {/* Totaux */}
        <div className="card p-5">
          <div className="flex justify-end">
            <div className="w-64 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600"><span>Sous-total HT</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>TVA</span><span>{fmt(taxAmount)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-2 text-base">
                <span>Total TTC</span><span className="text-primary-600">{fmt(total)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-6">
            {isSubmitting ? 'Création...' : 'Créer le devis'}
          </button>
        </div>
      </form>
    </div>
  );
}
