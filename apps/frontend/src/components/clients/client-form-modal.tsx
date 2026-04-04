'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import { api } from '@/lib/api';

const schema = z.object({
  firstName: z.string().min(1, 'Requis'),
  lastName:  z.string().min(1, 'Requis'),
  phone:     z.string().min(7, 'Numéro invalide'),
  email:     z.string().email('Email invalide').optional().or(z.literal('')),
  company:   z.string().optional(),
  status:    z.enum(['PROSPECT', 'ACTIVE', 'INACTIVE', 'DNC']).optional(),
  notes:     z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  client: any | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ClientFormModal({ client, onClose, onSaved }: Props) {
  const isEdit = !!client;
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: client ?? {},
  });

  useEffect(() => { reset(client ?? {}); }, [client, reset]);

  const onSubmit = async (data: FormData) => {
    if (isEdit) {
      await api.patch(`/clients/${client.id}`, data);
    } else {
      await api.post('/clients', data);
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Modifier le client' : 'Nouveau client'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom" error={errors.firstName?.message}>
              <input {...register('firstName')} className="input-field" placeholder="Jean" />
            </Field>
            <Field label="Nom" error={errors.lastName?.message}>
              <input {...register('lastName')} className="input-field" placeholder="Dupont" />
            </Field>
          </div>

          <Field label="Téléphone *" error={errors.phone?.message}>
            <input {...register('phone')} className="input-field" placeholder="+33612345678" />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" className="input-field" placeholder="jean@example.com" />
          </Field>

          <Field label="Entreprise" error={errors.company?.message}>
            <input {...register('company')} className="input-field" placeholder="Acme Corp" />
          </Field>

          <Field label="Statut">
            <select {...register('status')} className="input-field">
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Inactif</option>
              <option value="DNC">Ne pas appeler</option>
            </select>
          </Field>

          <Field label="Notes">
            <textarea {...register('notes')} className="input-field resize-none" rows={3} />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
              {isSubmitting ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
