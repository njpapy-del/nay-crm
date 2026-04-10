'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, CheckCircle2, Clock, User } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface ResponseValue {
  fieldId: string;
  value: unknown;
  field: { label: string; type: string };
}

interface ScriptResponse {
  id: string;
  isComplete: boolean;
  callId?: string;
  createdAt: string;
  agent: { firstName: string; lastName: string };
  values: ResponseValue[];
}

export default function ResponsesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [script, setScript] = useState<any>(null);
  const [responses, setResponses] = useState<ScriptResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { load(); }, [id, page]);

  async function load() {
    setLoading(true);
    try {
      const [sRes, rRes] = await Promise.all([
        api.get(`/scripts/${id}`),
        api.get(`/scripts/${id}/responses?page=${page}&limit=20`),
      ]);
      setScript(sRes.data);
      const rData = rRes.data?.data ?? rRes.data ?? [];
      setResponses(Array.isArray(rData) ? rData : []);
      setTotal(rRes.data?.total ?? 0);
    } catch (e: any) { console.error('[script responses]', e?.message); }
    finally { setLoading(false); }
  }

  async function exportCsv() {
    const res = await api.get(`/scripts/${id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `script_${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function formatValue(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (Array.isArray(v)) return (v as string[]).join(', ') || '—';
    return String(v) || '—';
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/scripts')} className="p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{script?.title ?? 'Script'} — Réponses</h1>
            <p className="text-sm text-gray-400">{total} réponse{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button onClick={exportCsv} className="btn-secondary flex items-center gap-2 text-sm">
          <Download size={15} /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : responses.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Clock size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Aucune réponse enregistrée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {responses.map(r => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              {/* Row header */}
              <button
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                className="w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                <div className={clsx(
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center',
                  r.isComplete ? 'bg-green-100' : 'bg-amber-100',
                )}>
                  {r.isComplete
                    ? <CheckCircle2 size={14} className="text-green-600" />
                    : <Clock size={14} className="text-amber-600" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-gray-400 shrink-0" />
                    <span className="text-sm font-medium text-gray-800">
                      {r.agent.firstName} {r.agent.lastName}
                    </span>
                    {r.callId && (
                      <span className="text-xs text-gray-400 truncate">· Appel {r.callId.slice(-8)}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(r.createdAt).toLocaleString('fr-FR')} · {r.values.length} réponse{r.values.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <span className={clsx(
                  'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                  r.isComplete ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                )}>
                  {r.isComplete ? 'Complet' : 'En cours'}
                </span>
              </button>

              {/* Expanded values */}
              {expanded === r.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(script?.fields ?? []).map((f: any) => {
                      const val = r.values.find(v => v.fieldId === f.id);
                      return (
                        <div key={f.id} className="bg-white rounded-lg border border-gray-200 px-3 py-2.5">
                          <p className="text-xs text-gray-400 font-medium mb-0.5">{f.label}</p>
                          <p className="text-sm text-gray-800 font-medium">
                            {val ? formatValue(val.value) : <span className="text-gray-300 italic">—</span>}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
            className="btn-secondary text-sm disabled:opacity-40">Précédent</button>
          <span className="text-sm text-gray-500 self-center">Page {page} / {Math.ceil(total / 20)}</span>
          <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}
            className="btn-secondary text-sm disabled:opacity-40">Suivant</button>
        </div>
      )}
    </div>
  );
}
