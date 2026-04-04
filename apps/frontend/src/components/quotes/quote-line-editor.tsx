'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useFieldArray, Control, UseFormRegister } from 'react-hook-form';

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: Control<any, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
}

export function QuoteLineEditor({ control, register }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const addLine = () => append({ description: '', quantity: 1, unitPrice: 0, taxRate: 20 });

  return (
    <div className="space-y-2">
      {/* En-têtes */}
      <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 px-1">
        <span className="col-span-5">Désignation *</span>
        <span className="col-span-2">Quantité</span>
        <span className="col-span-2">P.U. HT (€)</span>
        <span className="col-span-2">TVA (%)</span>
        <span className="col-span-1" />
      </div>

      {/* Lignes */}
      {fields.map((field, i) => (
        <div key={field.id} className="grid grid-cols-12 gap-2 items-start">
          <div className="col-span-5">
            <input
              {...register(`lines.${i}.description`)}
              className="input-field text-sm"
              placeholder="Description du produit/service"
            />
          </div>
          <div className="col-span-2">
            <input
              {...register(`lines.${i}.quantity`, { valueAsNumber: true })}
              type="number" step="0.001" min="0.001"
              className="input-field text-sm"
            />
          </div>
          <div className="col-span-2">
            <input
              {...register(`lines.${i}.unitPrice`, { valueAsNumber: true })}
              type="number" step="0.01" min="0"
              className="input-field text-sm"
            />
          </div>
          <div className="col-span-2">
            <input
              {...register(`lines.${i}.taxRate`, { valueAsNumber: true })}
              type="number" step="0.1" min="0" max="100"
              className="input-field text-sm"
            />
          </div>
          <div className="col-span-1 flex justify-center pt-1.5">
            <button type="button" onClick={() => remove(i)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ))}

      {fields.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed rounded-lg">
          Aucune ligne — cliquez sur &quot;Ajouter une ligne&quot;
        </p>
      )}

      <button type="button" onClick={addLine}
        className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium mt-1">
        <Plus size={16} /> Ajouter une ligne
      </button>
    </div>
  );
}
