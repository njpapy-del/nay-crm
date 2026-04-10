'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, Lock } from 'lucide-react';
import { api } from '@/lib/api';
import { Client } from './clients-table';

const schema = z.object({
  firstName:  z.string().min(1, 'Requis'),
  lastName:   z.string().min(1, 'Requis'),
  phone:      z.string().min(7, 'Numéro invalide'),
  email:      z.string().email('Email invalide').optional().or(z.literal('')),
  company:    z.string().optional(),
  address:    z.string().optional(),
  postalCode: z.string().optional(),
  status:     z.enum(['PROSPECT', 'ACTIVE', 'INACTIVE', 'DNC']).optional(),
  notes:      z.string().optional(),
});
type FormData = z.infer<typeof schema>;

interface Props {
  client: Client | null;
  userRole: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ClientFormModal({ client, userRole, onClose, onSaved }: Props) {
  const isEdit = !!client;
  const isManagerOrAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';
  const isQualified = !!client?.qualification;
  // Agent ne peut pas éditer un client qualifié
  const readOnly = !isManagerOrAdmin && isQualified;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: client ? {
      firstName:  client.firstName,
      lastName:   client.lastName,
      phone:      client.phone,
      email:      client.email ?? '',
      company:    client.company ?? '',
      address:    client.address ?? '',
      postalCode: client.postalCode ?? '',
      notes:      client.notes ?? '',
    } : {},
  });

  useEffect(() => {
    reset(client ? {
      firstName:  client.firstName,
      lastName:   client.lastName,
      phone:      client.phone,
      email:      client.email ?? '',
      company:    client.company ?? '',
      address:    client.address ?? '',
      postalCode: client.postalCode ?? '',
      notes:      client.notes ?? '',
    } : {});
  }, [client, reset]);

  const onSubmit = async (data: FormData) => {
    if (readOnly) return;
    if (isEdit) {
      await api.patch(`/clients/${client!.id}`, data);
    } else {
      await api.post('/clients', data);
    }
    onSaved();
  };

  const inputClass = (disabled?: boolean) =>
    `input-field ${disabled || readOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Modifier le client' : 'Nouveau client'}
            </h2>
            {readOnly && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 mt-0.5">
                <Lock size={12} /> Client qualifié — lecture seule (agent)
              </p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nom / Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prénom *" error={errors.firstName?.message}>
              <input {...register('firstName')} disabled={readOnly} className={inputClass()} placeholder="Jean" />
            </Field>
            <Field label="Nom *" error={errors.lastName?.message}>
              <input {...register('lastName')} disabled={readOnly} className={inputClass()} placeholder="Dupont" />
            </Field>
          </div>

          {/* Téléphone */}
          <Field label="Téléphone *" error={errors.phone?.message}>
            <input {...register('phone')} disabled={readOnly} className={inputClass()} placeholder="+33612345678" />
          </Field>

          {/* Email */}
          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" disabled={readOnly} className={inputClass()} placeholder="jean@example.com" />
          </Field>

          {/* Entreprise — Manager/Admin uniquement */}
          {isManagerOrAdmin && (
            <Field label="Entreprise" error={errors.company?.message}>
              <input {...register('company')} className="input-field" placeholder="Acme Corp" />
            </Field>
          )}

          {/* Adresse + Code postal */}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Adresse" error={errors.address?.message}>
              <input {...register('address')} disabled={readOnly} className={inputClass()} placeholder="12 rue de la Paix" />
            </Field>
            <Field label="Code postal" error={errors.postalCode?.message}>
              <input {...register('postalCode')} disabled={readOnly} className={inputClass()} placeholder="75001" />
            </Field>
          </div>

          {/* Commentaires */}
          <Field label="Commentaires" error={errors.notes?.message}>
            <textarea {...register('notes')} disabled={readOnly} className={`${inputClass()} resize-none`} rows={3} placeholder="Notes sur le client..." />
          </Field>

          {/* Statut — Manager/Admin uniquement */}
          {isManagerOrAdmin && (
            <Field label="Statut">
              <select {...register('status')} className="input-field">
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Actif</option>
                <option value="INACTIVE">Inactif</option>
                <option value="DNC">Ne pas appeler</option>
              </select>
            </Field>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              {readOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? 'Enregistrement...' : isEdit ? 'Modifier' : 'Créer'}
              </button>
            )}
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
