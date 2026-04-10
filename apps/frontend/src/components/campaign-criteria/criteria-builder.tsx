'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, GripVertical, Save, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────────────

export type FieldType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTI_SELECT';

export interface FieldOption { label: string; value: string; isPositive: boolean; }
export interface FieldValidation { min?: number; max?: number; expected?: string; }

export interface CriteriaField {
  id?: string;
  label: string;
  key: string;
  type: FieldType;
  required: boolean;
  weight: number;
  position: number;
  options?: FieldOption[];
  validation?: FieldValidation;
}

export interface Criteria {
  id?: string;
  name: string;
  description?: string;
  minScoreOk: number;
  fields: CriteriaField[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'TEXT',         label: 'Texte' },
  { value: 'NUMBER',       label: 'Nombre' },
  { value: 'BOOLEAN',      label: 'Oui / Non' },
  { value: 'SELECT',       label: 'Sélection unique' },
  { value: 'MULTI_SELECT', label: 'Sélection multiple' },
];

const newField = (pos: number): CriteriaField => ({
  label: '', key: `champ_${pos + 1}`, type: 'TEXT',
  required: false, weight: 1, position: pos,
});

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 40);

// ─── Sous-composant : un champ ───────────────────────────────────────────────

function FieldRow({
  field, index, total,
  onChange, onRemove, onMove,
}: {
  field: CriteriaField; index: number; total: number;
  onChange: (f: CriteriaField) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [open, setOpen] = useState(true);

  const set = <K extends keyof CriteriaField>(k: K, v: CriteriaField[K]) =>
    onChange({ ...field, [k]: v });

  const setOption = (i: number, patch: Partial<FieldOption>) => {
    const opts = [...(field.options ?? [])];
    opts[i] = { ...opts[i], ...patch };
    set('options', opts);
  };

  const addOption = () =>
    set('options', [...(field.options ?? []), { label: '', value: '', isPositive: true }]);

  const removeOption = (i: number) => {
    const opts = [...(field.options ?? [])];
    opts.splice(i, 1);
    set('options', opts);
  };

  const needsOptions = field.type === 'SELECT' || field.type === 'MULTI_SELECT';
  const needsValidation = field.type === 'NUMBER';

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 cursor-pointer" onClick={() => setOpen(!open)}>
        <GripVertical size={14} className="text-gray-300 shrink-0" />
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">
          {field.label || <span className="italic text-gray-400">Champ sans titre</span>}
        </span>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
          {FIELD_TYPES.find(t => t.value === field.type)?.label}
        </span>
        <span className="text-xs font-semibold text-primary-600">×{field.weight}</span>
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => onMove(-1)} disabled={index === 0} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronUp size={13} />
          </button>
          <button onClick={() => onMove(1)} disabled={index === total - 1} className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30">
            <ChevronDown size={13} />
          </button>
          <button onClick={onRemove} className="p-1 text-red-400 hover:text-red-600">
            <Trash2 size={13} />
          </button>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
      </div>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Label *</label>
              <input
                className="input-field text-sm"
                value={field.label}
                onChange={e => {
                  const label = e.target.value;
                  set('label', label);
                  if (!field.id) set('key', slugify(label));
                }}
                placeholder="Ex : Propriétaire du logement"
              />
            </div>
            <div>
              <label className="label">Clé technique</label>
              <input
                className="input-field text-sm font-mono"
                value={field.key}
                onChange={e => set('key', slugify(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input-field text-sm" value={field.type}
                onChange={e => set('type', e.target.value as FieldType)}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Poids (1–10)</label>
              <input
                type="number" min={1} max={10}
                className="input-field text-sm"
                value={field.weight}
                onChange={e => set('weight', Math.max(1, Math.min(10, +e.target.value)))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" checked={field.required}
              onChange={e => set('required', e.target.checked)} className="rounded" />
            Champ obligatoire
          </label>

          {/* Options pour SELECT */}
          {needsOptions && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label mb-0">Options</label>
                <button onClick={addOption} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <Plus size={12} /> Ajouter
                </button>
              </div>
              {(field.options ?? []).map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="input-field text-sm flex-1" placeholder="Label"
                    value={opt.label} onChange={e => setOption(i, { label: e.target.value, value: slugify(e.target.value) })} />
                  <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                    <input type="checkbox" checked={opt.isPositive}
                      onChange={e => setOption(i, { isPositive: e.target.checked })} />
                    Positif
                  </label>
                  <button onClick={() => removeOption(i)} className="text-red-400 hover:text-red-600">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Validation pour NUMBER */}
          {needsValidation && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Min</label>
                <input type="number" className="input-field text-sm"
                  value={field.validation?.min ?? ''}
                  onChange={e => set('validation', { ...field.validation, min: e.target.value ? +e.target.value : undefined })} />
              </div>
              <div>
                <label className="label">Max</label>
                <input type="number" className="input-field text-sm"
                  value={field.validation?.max ?? ''}
                  onChange={e => set('validation', { ...field.validation, max: e.target.value ? +e.target.value : undefined })} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export function CriteriaBuilder({ campaignId }: { campaignId: string }) {
  const [criteria, setCriteria] = useState<Criteria>({
    name: 'Critères de qualification', minScoreOk: 70, fields: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);

  useEffect(() => {
    api.get(`/campaigns/${campaignId}/criteria`)
      .then(r => { if (r.data) setCriteria(r.data?.data ?? r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  const addField = () =>
    setCriteria(c => ({ ...c, fields: [...c.fields, newField(c.fields.length)] }));

  const updateField = (i: number, f: CriteriaField) =>
    setCriteria(c => { const fields = [...c.fields]; fields[i] = f; return { ...c, fields }; });

  const removeField = (i: number) =>
    setCriteria(c => ({ ...c, fields: c.fields.filter((_, j) => j !== i).map((f, j) => ({ ...f, position: j })) }));

  const moveField = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    setCriteria(c => {
      const fields = [...c.fields];
      [fields[i], fields[j]] = [fields[j], fields[i]];
      return { ...c, fields: fields.map((f, k) => ({ ...f, position: k })) };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/campaigns/${campaignId}/criteria`, criteria);
      setCriteria(res.data?.data ?? res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-10 text-center text-gray-400 text-sm">Chargement…</div>;

  return (
    <div className="space-y-5">
      {/* Config globale */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Configuration générale</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Nom des critères</label>
            <input className="input-field" value={criteria.name}
              onChange={e => setCriteria(c => ({ ...c, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Score minimum OK (%)</label>
            <input type="number" min={0} max={100} className="input-field"
              value={criteria.minScoreOk}
              onChange={e => setCriteria(c => ({ ...c, minScoreOk: +e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <input className="input-field" value={criteria.description ?? ''}
              onChange={e => setCriteria(c => ({ ...c, description: e.target.value }))}
              placeholder="Optionnel" />
          </div>
        </div>
      </div>

      {/* Champs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Champs ({criteria.fields.length})</h3>
          <button onClick={addField} className="btn-secondary flex items-center gap-1.5 text-sm">
            <Plus size={14} /> Ajouter un champ
          </button>
        </div>

        {criteria.fields.length === 0 && (
          <div className="py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
            Aucun champ — cliquez sur «&nbsp;Ajouter un champ&nbsp;» pour commencer
          </div>
        )}

        {criteria.fields.map((f, i) => (
          <FieldRow
            key={i} field={f} index={i} total={criteria.fields.length}
            onChange={v => updateField(i, v)}
            onRemove={() => removeField(i)}
            onMove={dir => moveField(i, dir)}
          />
        ))}
      </div>

      {/* Sauvegarde */}
      <div className="flex justify-end">
        <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
          <Save size={15} />
          {saving ? 'Enregistrement…' : saved ? '✓ Enregistré' : 'Enregistrer les critères'}
        </button>
      </div>
    </div>
  );
}
