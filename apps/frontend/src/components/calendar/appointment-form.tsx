'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { api } from '@/lib/api';

const schema = z.object({
  title: z.string().min(2, 'Titre requis'),
  description: z.string().optional(),
  startAt: z.string().min(1, 'Requis'),
  endAt: z.string().min(1, 'Requis'),
  agentId: z.string().min(1, 'Agent requis'),
  leadId: z.string().optional(),
  campaignId: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Agent { id: string; firstName: string; lastName: string; }
interface Props {
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentForm({ defaultDate, onClose, onSaved }: Props) {
  const [agents, setAgents] = useState<Agent[]>([]);
  useEffect(() => { api.get('/users?limit=100').then((r) => setAgents(r.data?.data ?? r.data ?? [])).catch(() => {}); }, []);

  const defaultStart = defaultDate ? `${defaultDate}T09:00` : '';
  const defaultEnd   = defaultDate ? `${defaultDate}T10:00` : '';

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { startAt: defaultStart, endAt: defaultEnd },
  });

  const onSubmit = async (data: FormData) => {
    await api.post('/appointments', data);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Nouveau rendez-vous</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
            <input {...register('title')} className="input-field" placeholder="Appel de qualification..." />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Début *</label>
              <input {...register('startAt')} type="datetime-local" className="input-field text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fin *</label>
              <input {...register('endAt')} type="datetime-local" className="input-field text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agent *</label>
            <select {...register('agentId')} className="input-field">
              <option value="">Sélectionner un agent...</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
            {errors.agentId && <p className="text-red-500 text-xs mt-1">{errors.agentId.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea {...register('description')} className="input-field resize-none text-sm" rows={2} />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary px-5">
              {isSubmitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
