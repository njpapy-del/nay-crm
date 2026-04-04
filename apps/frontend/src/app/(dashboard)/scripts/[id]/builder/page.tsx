'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, GripVertical, Trash2, ChevronDown, ChevronUp,
  Save, Eye, Type, Hash, Calendar, List, CheckSquare, CircleDot,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

// ─── Types ────────────────────────────────────────────────────────────────────

type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'RADIO' | 'CHECKBOX';

interface FieldCondition { ifFieldId: string; ifValue: string; action: 'show' | 'hide' }

interface ScriptField {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  order: number;
  options?: string[];
  conditions?: FieldCondition[];
  placeholder?: string;
}

interface Script {
  id: string;
  title: string;
  description?: string;
  campaign?: { name: string };
  fields: ScriptField[];
}

// ─── Field type config ────────────────────────────────────────────────────────

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ElementType }[] = [
  { value: 'TEXT',     label: 'Texte',           icon: Type },
  { value: 'NUMBER',   label: 'Numérique',       icon: Hash },
  { value: 'DATE',     label: 'Date',            icon: Calendar },
  { value: 'SELECT',   label: 'Liste déroulante',icon: List },
  { value: 'RADIO',    label: 'Choix unique',    icon: CircleDot },
  { value: 'CHECKBOX', label: 'Choix multiple',  icon: CheckSquare },
];

const hasOptions = (t: FieldType) => ['SELECT', 'RADIO', 'CHECKBOX'].includes(t);

// ─── Empty field factory ──────────────────────────────────────────────────────

const newField = (order: number): Omit<ScriptField, 'id'> => ({
  label: '', type: 'TEXT', required: false, order,
  options: [], conditions: [], placeholder: '',
});

// ─── FieldEditor component ────────────────────────────────────────────────────

function FieldEditor({
  field, index, total, allFields,
  onChange, onDelete, onMoveUp, onMoveDown,
}: {
  field: ScriptField;
  index: number; total: number; allFields: ScriptField[];
  onChange: (f: ScriptField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [optionInput, setOptionInput] = useState('');

  function addOption() {
    const v = optionInput.trim();
    if (!v) return;
    onChange({ ...field, options: [...(field.options ?? []), v] });
    setOptionInput('');
  }

  function removeOption(i: number) {
    onChange({ ...field, options: (field.options ?? []).filter((_, idx) => idx !== i) });
  }

  function addCondition() {
    onChange({ ...field, conditions: [...(field.conditions ?? []), { ifFieldId: '', ifValue: '', action: 'show' }] });
  }

  function updateCondition(i: number, partial: Partial<FieldCondition>) {
    const conds = [...(field.conditions ?? [])];
    conds[i] = { ...conds[i], ...partial };
    onChange({ ...field, conditions: conds });
  }

  function removeCondition(i: number) {
    onChange({ ...field, conditions: (field.conditions ?? []).filter((_, idx) => idx !== i) });
  }

  const TypeIcon = FIELD_TYPES.find(t => t.value === field.type)?.icon ?? Type;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <GripVertical size={16} className="text-gray-300 cursor-grab shrink-0" />
        <TypeIcon size={15} className="text-primary-500 shrink-0" />
        <span className="flex-1 font-medium text-sm text-gray-700 truncate">
          {field.label || <span className="text-gray-400 italic">Champ sans titre</span>}
        </span>
        <span className="text-xs text-gray-400">{FIELD_TYPES.find(t => t.value === field.type)?.label}</span>
        {field.required && <span className="text-xs bg-red-50 text-red-500 px-1.5 py-0.5 rounded">Requis</span>}
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronUp size={14} /></button>
          <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30"><ChevronDown size={14} /></button>
          <button onClick={() => setExpanded(e => !e)} className="p-1 rounded hover:bg-gray-200">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Label *</label>
              <input className="input w-full text-sm" value={field.label}
                onChange={e => onChange({ ...field, label: e.target.value })} placeholder="Ex: Nom du client" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select className="input w-full text-sm" value={field.type}
                onChange={e => onChange({ ...field, type: e.target.value as FieldType, options: [] })}>
                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={field.required}
                onChange={e => onChange({ ...field, required: e.target.checked })}
                className="rounded border-gray-300" />
              <span className="text-gray-700">Champ obligatoire</span>
            </label>
            {!hasOptions(field.type) && (
              <div className="flex-1">
                <input className="input w-full text-sm" value={field.placeholder ?? ''}
                  onChange={e => onChange({ ...field, placeholder: e.target.value })}
                  placeholder="Texte indicatif (placeholder)" />
              </div>
            )}
          </div>

          {/* Options for SELECT / RADIO / CHECKBOX */}
          {hasOptions(field.type) && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Options</label>
              <div className="space-y-1.5 mb-2">
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">{opt}</span>
                    <button onClick={() => removeOption(i)} className="p-1 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="input flex-1 text-sm" value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addOption()}
                  placeholder="Nouvelle option…" />
                <button onClick={addOption} className="btn-secondary text-sm px-3">Ajouter</button>
              </div>
            </div>
          )}

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-gray-600">Conditions d'affichage</label>
              <button onClick={addCondition} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Ajouter</button>
            </div>
            {(field.conditions ?? []).length === 0 ? (
              <p className="text-xs text-gray-400 italic">Toujours affiché</p>
            ) : (
              <div className="space-y-2">
                {(field.conditions ?? []).map((cond, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-xs text-amber-700 font-medium shrink-0">Si</span>
                    <select className="input flex-1 text-xs py-1" value={cond.ifFieldId}
                      onChange={e => updateCondition(i, { ifFieldId: e.target.value })}>
                      <option value="">Champ…</option>
                      {allFields.filter(f => f.id !== field.id).map(f => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                    <span className="text-xs text-amber-700 shrink-0">=</span>
                    <input className="input w-24 text-xs py-1" value={cond.ifValue}
                      onChange={e => updateCondition(i, { ifValue: e.target.value })} placeholder="valeur" />
                    <select className="input text-xs py-1" value={cond.action}
                      onChange={e => updateCondition(i, { action: e.target.value as 'show' | 'hide' })}>
                      <option value="show">Afficher</option>
                      <option value="hide">Masquer</option>
                    </select>
                    <button onClick={() => removeCondition(i)} className="text-amber-500 hover:text-red-500"><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Builder page ─────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<Script | null>(null);
  const [fields, setFields] = useState<ScriptField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const pendingOps = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => { loadScript(); }, [id]);

  async function loadScript() {
    setLoading(true);
    const res = await api.get(`/scripts/${id}`);
    setScript(res.data);
    setFields(res.data.fields ?? []);
    setLoading(false);
  }

  // Debounced individual field save
  const saveField = useCallback(async (field: ScriptField) => {
    if (pendingOps.current.has(field.id)) clearTimeout(pendingOps.current.get(field.id));
    const t = setTimeout(async () => {
      try {
        await api.patch(`/scripts/${id}/fields/${field.id}`, {
          label: field.label, type: field.type, required: field.required,
          options: field.options, conditions: field.conditions, placeholder: field.placeholder,
        });
        setDirty(false);
      } catch { /* ignore transient errors */ }
    }, 800);
    pendingOps.current.set(field.id, t);
  }, [id]);

  function updateField(index: number, updated: ScriptField) {
    const next = [...fields];
    next[index] = updated;
    setFields(next);
    setDirty(true);
    if (updated.id) saveField(updated);
  }

  async function addField() {
    const order = fields.length;
    const res = await api.post(`/scripts/${id}/fields`, newField(order));
    setFields(f => [...f, res.data]);
  }

  async function deleteField(field: ScriptField, index: number) {
    if (!confirm(`Supprimer le champ "${field.label || 'sans titre'}" ?`)) return;
    if (pendingOps.current.has(field.id)) clearTimeout(pendingOps.current.get(field.id));
    await api.delete(`/scripts/${id}/fields/${field.id}`);
    setFields(f => f.filter((_, i) => i !== index));
  }

  async function moveField(from: number, to: number) {
    const next = [...fields];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    const reordered = next.map((f, i) => ({ ...f, order: i }));
    setFields(reordered);
    await api.patch(`/scripts/${id}/fields/reorder`, { ids: reordered.map(f => f.id) });
  }

  async function saveAll() {
    setSaving(true);
    try {
      // Flush all pending debounced saves immediately
      await Promise.all(fields.map(f =>
        api.patch(`/scripts/${id}/fields/${f.id}`, {
          label: f.label, type: f.type, required: f.required,
          options: f.options, conditions: f.conditions, placeholder: f.placeholder, order: f.order,
        }),
      ));
      setDirty(false);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Chargement…</div>;
  if (!script) return <div className="p-8 text-center text-red-500">Script introuvable</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/scripts')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{script.title}</h1>
            <p className="text-xs text-gray-400">{fields.length} champ{fields.length !== 1 ? 's' : ''} · {script.campaign?.name ?? 'Sans campagne'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-amber-600 font-medium">Modifications non sauvegardées</span>}
          <button onClick={() => router.push(`/scripts/${id}/preview`)}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Eye size={15} /> Aperçu
          </button>
          <button onClick={saveAll} disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm">
            <Save size={15} /> {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {fields.length === 0 ? (
            <div className="text-center py-16 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">
              <Type size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucun champ</p>
              <p className="text-sm">Ajoutez votre premier champ ci-dessous</p>
            </div>
          ) : (
            fields.map((field, index) => (
              <FieldEditor
                key={field.id}
                field={field}
                index={index}
                total={fields.length}
                allFields={fields}
                onChange={updated => updateField(index, updated)}
                onDelete={() => deleteField(field, index)}
                onMoveUp={() => moveField(index, index - 1)}
                onMoveDown={() => moveField(index, index + 1)}
              />
            ))
          )}

          <button onClick={addField}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all">
            <Plus size={16} /> Ajouter un champ
          </button>
        </div>
      </div>
    </div>
  );
}
