'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload, ArrowLeft, ArrowRight, CheckCircle, AlertCircle,
  FileText, Loader2, Check,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

type Step = 1 | 2 | 3 | 4 | 5;

interface Campaign { id: string; name: string; }
interface ContactList { id: string; name: string; }

const STEPS = [
  { n: 1, label: 'Fichier' },
  { n: 2, label: 'Mapping' },
  { n: 3, label: 'Validation' },
  { n: 4, label: 'Aperçu' },
  { n: 5, label: 'Confirmation' },
];

const CONTACT_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'phone',     label: 'Téléphone *', required: true },
  { key: 'firstName', label: 'Prénom' },
  { key: 'lastName',  label: 'Nom' },
  { key: 'email',     label: 'Email' },
  { key: 'company',   label: 'Société' },
  { key: 'notes',     label: 'Notes' },
];

export default function ImportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preListId = searchParams.get('listId') ?? '';

  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [listId, setListId] = useState(preListId);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get('/lists?status=ACTIVE&limit=100').then((r) => setLists(r.data.data)).catch(() => {});
  }, []);

  // Step 1 → 2: upload et récupération des headers
  const handleFileSelect = async (f: File) => {
    setFile(f);
    setLoading(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const res = await api.post('/imports/headers', fd);
      setHeaders(res.data.headers);
      // Auto-mapping heuristique
      const auto: Record<string, string> = {};
      res.data.headers.forEach((h: string) => {
        const lh = h.toLowerCase();
        if (lh.includes('phone') || lh.includes('tel') || lh.includes('mobile') || lh.includes('num')) auto.phone = h;
        if (lh.includes('prenom') || lh.includes('first')) auto.firstName = h;
        if (lh.includes('nom') || lh.includes('last') || lh.includes('name') && !lh.includes('first')) auto.lastName = h;
        if (lh.includes('email') || lh.includes('mail')) auto.email = h;
        if (lh.includes('soci') || lh.includes('company') || lh.includes('entreprise')) auto.company = h;
      });
      setColumnMap(auto);
      setStep(2);
    } finally { setLoading(false); }
  };

  // Step 2 → 3: validation
  const handleMapping = async () => {
    if (!columnMap.phone) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('columnMap', JSON.stringify(columnMap));
      fd.append('maxRows', '5');
      const res = await api.post(`/imports/preview/${listId || 'none'}`, fd);
      setPreview(res.data.rows);
      setStep(3);
    } finally { setLoading(false); }
  };

  // Step 4 → 5: import final
  const handleImport = async () => {
    if (!listId) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file!);
      fd.append('columnMap', JSON.stringify(columnMap));
      const res = await api.post(`/imports/list/${listId}`, fd);
      setResult(res.data);
      setStep(5);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/lists')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Importer des contacts</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex flex-col items-center gap-1">
              <div className={clsx('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors',
                step > s.n ? 'bg-green-500 text-white' :
                step === s.n ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400')}>
                {step > s.n ? <Check size={14} /> : s.n}
              </div>
              <span className={clsx('text-[11px] font-medium whitespace-nowrap',
                step === s.n ? 'text-primary-600' : 'text-gray-400')}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={clsx('flex-1 h-0.5 mb-4 mx-1 transition-colors',
                step > s.n ? 'bg-green-400' : 'bg-gray-200')} />
            )}
          </div>
        ))}
      </div>

      {/* Card contenu */}
      <div className="card p-6">

        {/* STEP 1 — Upload */}
        {step === 1 && (
          <div className="space-y-5">
            <p className="text-sm text-gray-600">Sélectionnez une liste de destination puis uploadez votre fichier CSV.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Liste de destination *</label>
              <select value={listId} onChange={(e) => setListId(e.target.value)} className="input-field text-sm w-full">
                <option value="">Sélectionner une liste…</option>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50/30 transition-colors">
              <Upload size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500 font-medium">
                {file ? file.name : 'Cliquez ou glissez un fichier CSV'}
              </p>
              <p className="text-xs text-gray-400 mt-1">Format UTF-8, max 10 Mo</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
            </div>
            {loading && <div className="text-center text-sm text-gray-400 flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Analyse du fichier…</div>}
            {!listId && file && (
              <p className="text-xs text-red-500">Sélectionnez une liste avant de continuer.</p>
            )}
          </div>
        )}

        {/* STEP 2 — Mapping colonnes */}
        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Associez les colonnes de votre fichier aux champs contacts.</p>
            <div className="space-y-3">
              {CONTACT_FIELDS.map((field) => (
                <div key={field.key} className="flex items-center gap-3">
                  <label className="w-28 text-sm font-medium text-gray-700 shrink-0">{field.label}</label>
                  <select
                    value={columnMap[field.key] ?? ''}
                    onChange={(e) => setColumnMap((prev) => ({ ...prev, [field.key]: e.target.value || '' }))}
                    className={clsx('input-field text-sm flex-1',
                      field.required && !columnMap[field.key] && 'border-red-300 focus:ring-red-300')}>
                    <option value="">— Ignorer —</option>
                    {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(1)} className="btn-secondary text-sm flex items-center gap-1.5"><ArrowLeft size={14} /> Retour</button>
              <button onClick={handleMapping} disabled={!columnMap.phone || loading}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />} Valider
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — Validation aperçu */}
        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Aperçu des 5 premières lignes après mapping :</p>
            <div className="overflow-x-auto rounded-lg border border-gray-100">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(preview[0] ?? {}).filter((k) => k !== 'row').map((k) => (
                      <th key={k} className="px-3 py-2 text-left font-semibold text-gray-500 uppercase">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {preview.map((row, i) => (
                    <tr key={i}>
                      {Object.entries(row).filter(([k]) => k !== 'row').map(([k, v]) => (
                        <td key={k} className="px-3 py-2 text-gray-700">{String(v ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep(2)} className="btn-secondary text-sm flex items-center gap-1.5"><ArrowLeft size={14} /> Retour</button>
              <button onClick={() => setStep(4)} className="btn-primary text-sm flex items-center gap-1.5">
                <ArrowRight size={14} /> Continuer
              </button>
            </div>
          </div>
        )}

        {/* STEP 4 — Confirmation avant import */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-blue-700 font-semibold"><FileText size={16} /> Récapitulatif</div>
              <div className="text-gray-600">Fichier : <span className="font-medium text-gray-900">{file?.name}</span></div>
              <div className="text-gray-600">Liste : <span className="font-medium text-gray-900">{lists.find((l) => l.id === listId)?.name}</span></div>
              <div className="text-gray-600">Champ téléphone : <span className="font-medium text-gray-900">{columnMap.phone}</span></div>
            </div>
            <p className="text-xs text-gray-500">Les doublons seront ignorés. Les numéros blacklistés seront marqués mais importés.</p>
            <div className="flex justify-between">
              <button onClick={() => setStep(3)} className="btn-secondary text-sm flex items-center gap-1.5"><ArrowLeft size={14} /> Retour</button>
              <button onClick={handleImport} disabled={loading}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Lancer l'import
              </button>
            </div>
          </div>
        )}

        {/* STEP 5 — Résultat */}
        {step === 5 && result && (
          <div className="space-y-4 text-center">
            <CheckCircle size={48} className="mx-auto text-green-500" />
            <h2 className="text-lg font-bold text-gray-900">Import terminé !</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                { label: 'Importés', value: result.importedRows, color: 'text-green-600' },
                { label: 'Ignorés', value: result.skippedRows, color: 'text-gray-500' },
                { label: 'Doublons', value: result.duplicates, color: 'text-yellow-600' },
                { label: 'Erreurs', value: result.errorRows, color: 'text-red-500' },
              ].map((s) => (
                <div key={s.label} className="card p-3">
                  <p className={clsx('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>
            {result.errors?.length > 0 && (
              <div className="text-left rounded-lg bg-red-50 border border-red-100 p-3 text-xs text-red-700 space-y-1">
                <p className="font-semibold flex items-center gap-1"><AlertCircle size={13} /> Erreurs</p>
                {result.errors.slice(0, 5).map((e: any, i: number) => (
                  <p key={i}>Ligne {e.row} : {e.message}</p>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-center">
              <button onClick={() => router.push(`/lists/${listId}`)} className="btn-primary text-sm">
                Voir la liste
              </button>
              <button onClick={() => { setStep(1); setFile(null); setResult(null); setPreview([]); }}
                className="btn-secondary text-sm">
                Nouvel import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
