'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z.object({
  name: z.string().min(2, 'Nom trop court'),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE']).default('DRAFT'),
});
type FormData = z.infer<typeof schema>;

export default function NewCampaignPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'DRAFT' },
  });

  const onSubmit = async (data: FormData) => {
    await api.post('/campaigns', data);
    router.push('/campaigns');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nouvelle campagne</h1>
        <p className="text-gray-500 text-sm mt-0.5">Créez une campagne et assignez-y des agents et leads</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input {...register('name')} className="input-field" placeholder="Campagne relance clients..." />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea {...register('description')} className="input-field resize-none" rows={3}
            placeholder="Objectif, contexte..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input {...register('startDate')} type="date" className="input-field" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input {...register('endDate')} type="date" className="input-field" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Statut initial</label>
          <select {...register('status')} className="input-field">
            <option value="DRAFT">Brouillon</option>
            <option value="ACTIVE">Active</option>
          </select>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary">Annuler</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-6">
            {isSubmitting ? 'Création...' : 'Créer la campagne'}
          </button>
        </div>
      </form>
    </div>
  );
}
