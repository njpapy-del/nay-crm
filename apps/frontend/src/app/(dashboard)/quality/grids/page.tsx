'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, Save, X } from 'lucide-react';
import { clsx } from 'clsx';

interface GridItem { id?: string; name: string; weight: number; maxScore: number; isRequired: boolean; position: number; }
interface Grid { id: string; name: string; isDefault: boolean; campaignId?: string; campaign?: { name: string }; items: GridItem[]; }

const emptyItem = (): GridItem => ({ name: '', weight: 1, maxScore: 5, isRequired: false, position: 0 });

function GridForm({ initial, onSave, onCancel }: { initial?: Partial<Grid>; onSave: (d: any) => void; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? false);
  const [items, setItems] = useState<GridItem[]>(initial?.items ?? [emptyItem()]);

  const addItem = () => setItems(prev => [...prev, emptyItem()]);
  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, k: keyof GridItem, v: any) =>
    setItems(prev => prev.map((item, idx) => idx === i ? { ...item, [k]: v } : item));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label text-xs mb-1">Nom de la grille</label>
          <input value={name} onChange={e => setName(e.target.value)} className="input-field" placeholder="Ex: Grille standard" />
        </div>
        <div className="flex items-center gap-2 mt-5">
          <input type="checkbox" id="isDefault" checked={isDefault} onChange={e => setIsDefault(e.target.checked)} className="rounded" />
          <label htmlFor="isDefault" className="text-sm text-gray-700">Grille par défaut</label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Critères d'évaluation</label>
          <button onClick={addItem} className="flex items-center gap-1 text-xs text-primary-600 hover:underline">
            <Plus size={12} /> Ajouter
          </button>
        </div>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <input value={item.name} onChange={e => updateItem(i, 'name', e.target.value)}
                placeholder="Nom du critère" className="input-field flex-1 text-sm" />
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Poids</label>
                <input type="number" value={item.weight} min={0.1} max={10} step={0.1}
                  onChange={e => updateItem(i, 'weight', +e.target.value)}
                  className="input-field w-16 text-sm text-center" />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-xs text-gray-500">Max</label>
                <select value={item.maxScore} onChange={e => updateItem(i, 'maxScore', +e.target.value)}
                  className="input-field w-14 text-sm">
                  {[5, 10].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <input type="checkbox" checked={item.isRequired} onChange={e => updateItem(i, 'isRequired', e.target.checked)}
                title="Obligatoire" className="rounded" />
              <button onClick={() => removeItem(i)} className="text-gray-300 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary text-sm">Annuler</button>
        <button onClick={() => onSave({ name, isDefault, items: items.map((it, idx) => ({ ...it, position: idx })) })}
          disabled={!name.trim() || items.some(it => !it.name.trim())}
          className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
          <Save size={14} /> Enregistrer
        </button>
      </div>
    </div>
  );
}

export default function QualityGridsPage() {
  const [grids, setGrids] = useState<Grid[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/quality-grids');
      setGrids(r.data?.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (data: any, id?: string) => {
    if (id) await api.patch(`/quality-grids/${id}`, data);
    else await api.post('/quality-grids', data);
    setCreating(false); setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Supprimer cette grille ?')) return;
    await api.delete(`/quality-grids/${id}`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grilles Qualité</h1>
          <p className="text-sm text-gray-500 mt-0.5">{grids.length} grille(s) configurée(s)</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle grille
        </button>
      </div>

      {creating && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Nouvelle grille</h2>
          <GridForm onSave={data => save(data)} onCancel={() => setCreating(false)} />
        </div>
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : (
        <div className="space-y-3">
          {grids.map(grid => (
            <div key={grid.id} className="card">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setExpanded(e => e === grid.id ? null : grid.id)}
                    className="text-gray-400 hover:text-gray-600">
                    {expanded === grid.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  <div>
                    <p className="font-medium text-gray-900">{grid.name}</p>
                    <p className="text-xs text-gray-400">{grid.items.length} critère(s) · {grid.campaign?.name ?? 'Toutes campagnes'}</p>
                  </div>
                  {grid.isDefault && (
                    <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">Défaut</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(grid.id)} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => remove(grid.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {editing === grid.id && (
                <div className="border-t border-gray-100 p-5">
                  <GridForm initial={grid} onSave={data => save(data, grid.id)} onCancel={() => setEditing(null)} />
                </div>
              )}

              {expanded === grid.id && editing !== grid.id && (
                <div className="border-t border-gray-100 p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {grid.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700">{item.name}</p>
                          <p className="text-xs text-gray-400">Poids {item.weight} · /{ item.maxScore}</p>
                        </div>
                        {item.isRequired && <span className="text-xs text-red-500 font-medium">Req.</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
