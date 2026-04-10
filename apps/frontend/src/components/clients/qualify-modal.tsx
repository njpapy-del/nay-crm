'use client';

import { useState } from 'react';
import { X, Award, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Client } from './clients-table';
import { clsx } from 'clsx';

const OPTIONS = [
  { value: 'RDV',     label: 'RDV',     color: 'bg-blue-50 border-blue-400 text-blue-700',   active: 'ring-2 ring-blue-400' },
  { value: 'FACTURE', label: 'Facturé', color: 'bg-orange-50 border-orange-400 text-orange-700', active: 'ring-2 ring-orange-400' },
  { value: 'VENDU',   label: 'Vendu',   color: 'bg-green-50 border-green-400 text-green-700',  active: 'ring-2 ring-green-400' },
];

interface Props {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}

export function QualifyModal({ client, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<string>(client.qualification ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.patch(`/clients/${client.id}/qualify`, { qualification: selected });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="card w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-primary-600" />
            <h2 className="text-base font-semibold text-gray-900">Qualifier le client</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{client.firstName} {client.lastName}</span>
          {client.qualification && (
            <span className="text-gray-400 ml-1">(actuellement : {client.qualification})</span>
          )}
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {OPTIONS.map(({ value, label, color, active }) => (
            <button
              key={value}
              onClick={() => setSelected(value)}
              className={clsx(
                'flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 font-semibold text-sm transition-all',
                color,
                selected === value && active,
              )}
            >
              <span className="text-lg">{value === 'RDV' ? '📅' : value === 'FACTURE' ? '🧾' : '✅'}</span>
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button
            onClick={handleSave}
            disabled={!selected || saving}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}
