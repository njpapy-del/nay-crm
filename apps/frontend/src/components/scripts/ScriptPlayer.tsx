'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, ChevronDown } from 'lucide-react';
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
  fields: ScriptField[];
}

type Values = Record<string, unknown>;

// ─── Condition evaluator ──────────────────────────────────────────────────────

function isVisible(field: ScriptField, values: Values): boolean {
  const conds = field.conditions ?? [];
  if (conds.length === 0) return true;

  for (const c of conds) {
    if (!c.ifFieldId) continue;
    const val = values[c.ifFieldId];
    const matches = Array.isArray(val)
      ? (val as string[]).includes(c.ifValue)
      : String(val ?? '') === c.ifValue;

    if (c.action === 'show' && !matches) return false;
    if (c.action === 'hide' && matches) return false;
  }
  return true;
}

// ─── Individual field renderer ────────────────────────────────────────────────

function FieldRenderer({
  field, value, onChange,
}: {
  field: ScriptField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const cls = 'input w-full';

  switch (field.type) {
    case 'TEXT':
      return (
        <textarea className={clsx(cls, 'resize-none')} rows={2}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder} />
      );

    case 'NUMBER':
      return (
        <input type="number" className={cls}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
          placeholder={field.placeholder} />
      );

    case 'DATE':
      return (
        <input type="date" className={cls}
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)} />
      );

    case 'SELECT':
      return (
        <div className="relative">
          <select className={clsx(cls, 'appearance-none pr-8')}
            value={(value as string) ?? ''}
            onChange={e => onChange(e.target.value)}>
            <option value="">— Sélectionner —</option>
            {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      );

    case 'RADIO':
      return (
        <div className="space-y-2">
          {(field.options ?? []).map(o => (
            <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
              <input type="radio" name={field.id} value={o}
                checked={(value as string) === o}
                onChange={() => onChange(o)}
                className="accent-primary-600" />
              <span className="text-sm text-gray-700 group-hover:text-gray-900">{o}</span>
            </label>
          ))}
        </div>
      );

    case 'CHECKBOX':
      return (
        <div className="space-y-2">
          {(field.options ?? []).map(o => {
            const checked = ((value as string[]) ?? []).includes(o);
            return (
              <label key={o} className="flex items-center gap-2.5 cursor-pointer group">
                <input type="checkbox" checked={checked}
                  onChange={() => {
                    const arr = [...((value as string[]) ?? [])];
                    onChange(checked ? arr.filter(x => x !== o) : [...arr, o]);
                  }}
                  className="accent-primary-600 rounded" />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{o}</span>
              </label>
            );
          })}
        </div>
      );
  }
}

// ─── ScriptPlayer ─────────────────────────────────────────────────────────────

interface ScriptPlayerProps {
  scriptId: string;
  callId?: string;
  contactId?: string;
  campaignId?: string;
  onComplete?: (responseId: string) => void;
}

export function ScriptPlayer({ scriptId, callId, contactId, campaignId, onComplete }: ScriptPlayerProps) {
  const [script, setScript] = useState<Script | null>(null);
  const [values, setValues] = useState<Values>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [complete, setComplete] = useState(false);
  const [responseId, setResponseId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadScript();
  }, [scriptId, callId]);

  async function loadScript() {
    setLoading(true);
    try {
      const res = await api.get(`/scripts/${scriptId}`);
      setScript(res.data);
      // Load existing response if any
      if (callId) {
        const rRes = await api.get(`/scripts/${scriptId}/responses/call/${callId}`).catch(() => null);
        if (rRes?.data) {
          setResponseId(rRes.data.id);
          const loaded: Values = {};
          for (const v of rRes.data.values ?? []) loaded[v.fieldId] = v.value;
          setValues(loaded);
          setComplete(rRes.data.isComplete ?? false);
        }
      }
    } finally { setLoading(false); }
  }

  const autoSave = useCallback(async (vals: Values, isComplete = false) => {
    setSaving(true);
    try {
      const res = await api.post(`/scripts/${scriptId}/responses`, {
        callId, contactId, campaignId, isComplete, values: vals,
      });
      setResponseId(res.data.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally { setSaving(false); }
  }, [scriptId, callId, contactId, campaignId]);

  function handleChange(fieldId: string, val: unknown) {
    const next = { ...values, [fieldId]: val };
    setValues(next);
    // Debounce autosave 1.2s
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autoSave(next), 1200);
  }

  async function handleComplete() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await autoSave(values, true);
    setComplete(true);
    if (responseId && onComplete) onComplete(responseId);
  }

  if (loading) return (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={20} className="animate-spin text-gray-400" />
    </div>
  );

  if (!script) return <div className="text-red-500 text-sm p-4">Script introuvable</div>;

  const visibleFields = script.fields.filter(f => isVisible(f, values));
  const requiredDone = visibleFields
    .filter(f => f.required)
    .every(f => {
      const v = values[f.id];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== '' && v !== null;
    });

  return (
    <div className="space-y-4">
      {/* Script header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-gray-900">{script.title}</h3>
          {script.description && <p className="text-xs text-gray-500 mt-0.5">{script.description}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          {saving && <><Loader2 size={12} className="animate-spin" /> Sauvegarde…</>}
          {saved && !saving && <><CheckCircle2 size={12} className="text-green-500" /> Sauvegardé</>}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {visibleFields.map(field => (
          <div key={field.id} className={clsx(
            'p-4 rounded-xl border transition-all',
            values[field.id] !== undefined && values[field.id] !== ''
              ? 'border-green-200 bg-green-50'
              : 'border-gray-200 bg-white',
          )}>
            <label className="block text-sm font-medium text-gray-800 mb-2">
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <FieldRenderer
              field={field}
              value={values[field.id]}
              onChange={val => handleChange(field.id, val)}
            />
          </div>
        ))}
      </div>

      {/* Complete button */}
      {!complete ? (
        <button
          onClick={handleComplete}
          disabled={!requiredDone || saving}
          className={clsx(
            'w-full py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2',
            requiredDone
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-sm'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed',
          )}
        >
          <CheckCircle2 size={16} />
          {saving ? 'Enregistrement…' : 'Terminer le script'}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-3 bg-green-50 border border-green-200 rounded-xl text-green-700 font-medium text-sm">
          <CheckCircle2 size={16} /> Script complété
        </div>
      )}
    </div>
  );
}
