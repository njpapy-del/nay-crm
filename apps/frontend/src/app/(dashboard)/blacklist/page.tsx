'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldOff, Plus, Trash2, Upload, Download, Search,
  AlertCircle, Loader2, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Blacklist {
  id: string; name: string; scope: string; description?: string; createdAt: string;
  _count: { entries: number };
  campaign?: { name: string };
}

interface BlacklistEntry {
  id: string; phone: string; reason?: string; createdAt: string;
  addedBy?: { firstName: string; lastName: string };
}

const SCOPE_LABELS: Record<string, string> = {
  GLOBAL: 'Globale', TENANT: 'Entreprise', CAMPAIGN: 'Campagne',
};
const SCOPE_COLORS: Record<string, string> = {
  GLOBAL: 'bg-red-100 text-red-700',
  TENANT: 'bg-orange-100 text-orange-700',
  CAMPAIGN: 'bg-yellow-100 text-yellow-700',
};

export default function BlacklistPage() {
  const [lists, setLists] = useState<Blacklist[]>([]);
  const [active, setActive] = useState<Blacklist | null>(null);
  const [entries, setEntries] = useState<BlacklistEntry[]>([]);
  const [entriesTotal, setEntriesTotal] = useState(0);
  const [searchEntry, setSearchEntry] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newScope, setNewScope] = useState('TENANT');
  const [newPhone, setNewPhone] = useState('');
  const [newReason, setNewReason] = useState('');
  const [addingPhone, setAddingPhone] = useState(false);
  const [checkPhone, setCheckPhone] = useState('');
  const [checkResult, setCheckResult] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/blacklist');
      setLists(res.data.data ?? res.data);
    } finally { setLoading(false); }
  }, []);

  const loadEntries = useCallback(async (blId: string) => {
    setLoadingEntries(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (searchEntry) params.set('search', searchEntry);
      const res = await api.get(`/blacklist/${blId}/entries?${params}`);
      setEntries(res.data.data);
      setEntriesTotal(res.data.total);
    } finally { setLoadingEntries(false); }
  }, [searchEntry]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => {
    if (active) loadEntries(active.id);
  }, [active, loadEntries]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await api.post('/blacklist', { name: newName, scope: newScope });
    setNewName(''); setShowCreate(false);
    loadLists();
  };

  const handleDeleteList = async (id: string) => {
    if (!confirm('Supprimer cette blacklist et toutes ses entrées ?')) return;
    await api.delete(`/blacklist/${id}`);
    if (active?.id === id) setActive(null);
    loadLists();
  };

  const handleAddPhone = async () => {
    if (!active || !newPhone.trim()) return;
    setAddingPhone(true);
    try {
      await api.post(`/blacklist/${active.id}/entries`, { phone: newPhone.trim(), reason: newReason || undefined });
      setNewPhone(''); setNewReason('');
      loadEntries(active.id);
      loadLists();
    } finally { setAddingPhone(false); }
  };

  const handleRemoveEntry = async (entryId: string) => {
    if (!active) return;
    await api.delete(`/blacklist/entries/${entryId}`);
    loadEntries(active.id);
  };

  const handleImportCsv = async (file: File) => {
    if (!active) return;
    const fd = new FormData(); fd.append('file', file);
    await api.post(`/blacklist/${active.id}/entries/import`, fd);
    loadEntries(active.id); loadLists();
  };

  const handleExport = async (bl: Blacklist) => {
    const res = await api.get(`/blacklist/${bl.id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url;
    a.download = `blacklist-${bl.name}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCheck = async () => {
    if (!checkPhone.trim()) return;
    const res = await api.post('/blacklist/check', { phone: checkPhone.trim() });
    setCheckResult(res.data);
  };

  return (
    <div className="flex gap-5 h-[calc(100vh-5rem)] overflow-hidden">
      {/* Colonne gauche — liste des blacklists */}
      <div className="w-72 shrink-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Listes rouges</h1>
          <button onClick={() => setShowCreate(true)}
            className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <Plus size={15} />
          </button>
        </div>

        {/* Vérif rapide */}
        <div className="card p-3 space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Vérifier un numéro</p>
          <div className="flex gap-1.5">
            <input value={checkPhone} onChange={(e) => setCheckPhone(e.target.value)}
              placeholder="+33600000000" className="input-field text-xs flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()} />
            <button onClick={handleCheck} className="btn-primary text-xs px-2">OK</button>
          </div>
          {checkResult && (
            <div className={clsx('flex items-center gap-1.5 text-xs font-medium rounded-lg px-2 py-1.5',
              checkResult.blacklisted ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700')}>
              {checkResult.blacklisted
                ? <><AlertCircle size={12} /> Blacklisté — {checkResult.blacklist?.name}</>
                : <><ShieldOff size={12} /> Non blacklisté</>}
            </div>
          )}
        </div>

        {loading && (
          <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></div>
        )}
        {!loading && lists.map((bl) => (
          <button key={bl.id}
            onClick={() => setActive(bl)}
            className={clsx('card p-3 text-left transition-all hover:shadow-md',
              active?.id === bl.id && 'ring-2 ring-primary-400')}>
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-gray-900 truncate">{bl.name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                    SCOPE_COLORS[bl.scope])}>
                    {SCOPE_LABELS[bl.scope]}
                  </span>
                  <span className="text-[10px] text-gray-400">{bl._count.entries} numéros</span>
                </div>
              </div>
              <div className="flex gap-1 ml-2 shrink-0">
                <button onClick={(e) => { e.stopPropagation(); handleExport(bl); }}
                  className="p-1 text-gray-400 hover:text-blue-600 rounded"><Download size={13} /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteList(bl.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 rounded"><Trash2 size={13} /></button>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Colonne droite — entrées */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 overflow-hidden">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <ShieldOff size={36} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Sélectionnez une blacklist</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between shrink-0">
              <h2 className="font-bold text-gray-900">{active.name}
                <span className="text-sm font-normal text-gray-400 ml-2">{entriesTotal} numéro{entriesTotal !== 1 ? 's' : ''}</span>
              </h2>
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept=".csv" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImportCsv(e.target.files[0])} />
                <button onClick={() => fileRef.current?.click()}
                  className="btn-secondary text-xs flex items-center gap-1.5"><Upload size={13} /> Importer CSV</button>
                <button onClick={() => handleExport(active)}
                  className="btn-secondary text-xs flex items-center gap-1.5"><Download size={13} /> Exporter</button>
              </div>
            </div>

            {/* Ajout manuel */}
            <div className="card p-3 flex items-center gap-2 shrink-0">
              <input value={newPhone} onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Numéro à blacklister *" className="input-field text-sm flex-1" />
              <input value={newReason} onChange={(e) => setNewReason(e.target.value)}
                placeholder="Raison (optionnel)" className="input-field text-sm w-40" />
              <button onClick={handleAddPhone} disabled={!newPhone.trim() || addingPhone}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50 shrink-0">
                {addingPhone ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Ajouter
              </button>
            </div>

            {/* Recherche */}
            <div className="relative shrink-0">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={searchEntry} onChange={(e) => setSearchEntry(e.target.value)}
                placeholder="Rechercher un numéro…" className="input-field pl-8 text-sm w-full" />
            </div>

            {/* Liste entrées */}
            <div className="card flex-1 overflow-y-auto">
              {loadingEntries ? (
                <div className="p-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></div>
              ) : entries.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400">Aucune entrée</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                    <tr>
                      {['Téléphone', 'Raison', 'Ajouté par', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entries.map((e) => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-sm text-gray-900">{e.phone}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">{e.reason ?? '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500">
                          {e.addedBy ? `${e.addedBy.firstName} ${e.addedBy.lastName}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-400">
                          {new Date(e.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => handleRemoveEntry(e.id)}
                            title="Déblacklister"
                            className="p-1 text-gray-300 hover:text-red-500 rounded">
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80">
            <h2 className="font-bold text-gray-900 mb-4">Nouvelle blacklist</h2>
            <div className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom *" className="input-field text-sm w-full" />
              <select value={newScope} onChange={(e) => setNewScope(e.target.value)}
                className="input-field text-sm w-full">
                <option value="TENANT">Entreprise</option>
                <option value="GLOBAL">Globale</option>
                <option value="CAMPAIGN">Campagne</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                className="btn-primary text-sm disabled:opacity-50">Créer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
