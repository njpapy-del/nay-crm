'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Star, Plus, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { clsx } from 'clsx';

interface GridItem { id: string; name: string; weight: number; maxScore: number; isRequired: boolean; }
interface Grid { id: string; name: string; items: GridItem[]; }
interface Evaluation {
  id: string; score: number; maxScore: number; percentage: number; comment?: string; createdAt: string;
  agent: { firstName: string; lastName: string };
  evaluator: { firstName: string; lastName: string };
  grid: { name: string };
  callLog: { callerNumber: string; calleeNumber: string; durationSec: number; createdAt: string };
  items: { score: number; comment?: string; gridItem: { name: string; weight: number; maxScore: number } }[];
}

function ScoreBadge({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-600';
  return <span className={clsx('px-2 py-0.5 rounded-full text-xs font-semibold', color)}>{pct.toFixed(1)}%</span>;
}

function NewEvalModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [grids, setGrids] = useState<Grid[]>([]);
  const [selectedGrid, setSelectedGrid] = useState<Grid | null>(null);
  const [callLogId, setCallLogId] = useState('');
  const [agentId, setAgentId] = useState('');
  const [comment, setComment] = useState('');
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/quality-grids').then(r => setGrids(r.data?.data ?? []));
  }, []);

  const selectGrid = (id: string) => {
    const g = grids.find(g => g.id === id) ?? null;
    setSelectedGrid(g);
    setScores(g ? Object.fromEntries(g.items.map(i => [i.id, 0])) : {});
  };

  const save = async () => {
    if (!selectedGrid || !callLogId || !agentId) return;
    setSaving(true);
    try {
      await api.post('/quality/evaluations', {
        callLogId, agentId, gridId: selectedGrid.id, comment,
        items: selectedGrid.items.map(i => ({ gridItemId: i.id, score: scores[i.id] ?? 0 })),
      });
      onSaved();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">Nouvelle évaluation</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-xs mb-1">ID appel / log</label>
              <input value={callLogId} onChange={e => setCallLogId(e.target.value)} className="input-field text-sm" placeholder="callLogId" />
            </div>
            <div>
              <label className="label text-xs mb-1">ID agent</label>
              <input value={agentId} onChange={e => setAgentId(e.target.value)} className="input-field text-sm" placeholder="agentId" />
            </div>
          </div>
          <div>
            <label className="label text-xs mb-1">Grille d'évaluation</label>
            <select onChange={e => selectGrid(e.target.value)} className="input-field text-sm">
              <option value="">— Choisir une grille —</option>
              {grids.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>

          {selectedGrid && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Critères</p>
              {selectedGrid.items.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700">{item.name}</p>
                    <p className="text-xs text-gray-400">Poids {item.weight} · max {item.maxScore}</p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: item.maxScore + 1 }, (_, i) => i).map(v => (
                      <button key={v} onClick={() => setScores(s => ({ ...s, [item.id]: v }))}
                        className={clsx('w-7 h-7 rounded text-xs font-bold transition-colors',
                          scores[item.id] === v ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300')}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="label text-xs mb-1">Commentaire</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="input-field text-sm" />
          </div>
        </div>
        <div className="px-5 py-4 border-t flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={save} disabled={saving || !selectedGrid || !callLogId || !agentId}
            className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
            <Star size={14} /> {saving ? 'Enregistrement...' : 'Évaluer'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EvaluationsPage() {
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (agentFilter) params.set('agentId', agentFilter);
      const r = await api.get(`/quality/evaluations?${params}`);
      setEvals(r.data?.data ?? []);
      setTotal(r.data?.meta?.total ?? 0);
    } finally { setLoading(false); }
  }, [agentFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Évaluations d'appels</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} évaluation(s)</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle évaluation
        </button>
      </div>

      {showNew && <NewEvalModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : evals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune évaluation</div>
      ) : (
        <div className="space-y-3">
          {evals.map(ev => (
            <div key={ev.id} className="card">
              <div className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpanded(e => e === ev.id ? null : ev.id)}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center">
                    {ev.agent.firstName[0]}{ev.agent.lastName[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{ev.agent.firstName} {ev.agent.lastName}</p>
                    <p className="text-xs text-gray-400">{ev.grid.name} · {ev.callLog.callerNumber} → {ev.callLog.calleeNumber}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ScoreBadge pct={ev.percentage} />
                  <span className="text-xs text-gray-400">{new Date(ev.createdAt).toLocaleDateString('fr-FR')}</span>
                  {expanded === ev.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </div>

              {expanded === ev.id && (
                <div className="border-t border-gray-100 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {ev.items.map((it, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
                        <span className="text-sm text-gray-700">{it.gridItem.name}</span>
                        <span className="text-sm font-bold text-gray-900">{it.score}/{it.gridItem.maxScore}</span>
                      </div>
                    ))}
                  </div>
                  {ev.comment && <p className="text-sm text-gray-600 italic">"{ev.comment}"</p>}
                  <p className="text-xs text-gray-400">Évalué par {ev.evaluator.firstName} {ev.evaluator.lastName}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
