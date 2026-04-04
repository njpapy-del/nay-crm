'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  List, Plus, Upload, Search, Trash2, Eye, MoreHorizontal,
  Users, CheckCircle, Archive, Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface ContactList {
  id: string; name: string; source?: string; description?: string;
  status: string; totalContacts: number; createdAt: string;
  campaign?: { id: string; name: string };
  createdBy: { firstName: string; lastName: string };
  _count: { contacts: number; imports: number };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:     'bg-green-100 text-green-700',
  ARCHIVED:   'bg-gray-100 text-gray-600',
  PROCESSING: 'bg-blue-100 text-blue-700',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active', ARCHIVED: 'Archivée', PROCESSING: 'En traitement',
};

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ContactList[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSource, setNewSource] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/lists?${params}`);
      setLists(res.data.data);
      setTotal(res.data.total);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await api.post('/lists', { name: newName.trim(), source: newSource.trim() || undefined });
      setNewName(''); setNewSource(''); setShowCreate(false);
      load();
    } finally { setCreating(false); }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer la liste "${name}" et tous ses contacts ?`)) return;
    await api.delete(`/lists/${id}`);
    load();
  };

  const handleArchive = async (id: string) => {
    await api.patch(`/lists/${id}`, { status: 'ARCHIVED' });
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Listes de contacts</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} liste{total !== 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/lists/import')}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Upload size={15} /> Importer CSV
          </button>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} /> Nouvelle liste
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une liste…"
            className="input-field pl-8 text-sm"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="input-field text-sm w-40">
          <option value="">Tous statuts</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archivée</option>
          <option value="PROCESSING">En traitement</option>
        </select>
      </div>

      {/* Modal création */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-96">
            <h2 className="font-bold text-gray-900 mb-4">Nouvelle liste</h2>
            <div className="space-y-3">
              <input value={newName} onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la liste *" className="input-field text-sm w-full" />
              <input value={newSource} onChange={(e) => setNewSource(e.target.value)}
                placeholder="Source (optionnel)" className="input-field text-sm w-full" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="btn-secondary text-sm">Annuler</button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating}
                className="btn-primary text-sm flex items-center gap-1.5 disabled:opacity-50">
                {creating && <Loader2 size={13} className="animate-spin" />} Créer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">
            <Loader2 size={28} className="animate-spin mx-auto mb-2" />
          </div>
        ) : lists.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <List size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucune liste. Créez-en une ou importez un CSV.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Nom', 'Campagne', 'Source', 'Contacts', 'Imports', 'Statut', 'Créée le', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lists.map((list) => (
                <tr key={list.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button onClick={() => router.push(`/lists/${list.id}`)}
                      className="font-medium text-gray-900 hover:text-primary-600 text-left">
                      {list.name}
                    </button>
                    {list.description && (
                      <p className="text-xs text-gray-400 truncate max-w-[200px]">{list.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {list.campaign?.name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {list.source ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-gray-700 font-medium">
                      <Users size={13} className="text-gray-400" /> {list._count.contacts.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{list._count.imports}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                      STATUS_COLORS[list.status] ?? 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[list.status] ?? list.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(list.createdAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => router.push(`/lists/${list.id}`)}
                        title="Voir" className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => router.push(`/lists/import?listId=${list.id}`)}
                        title="Importer" className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-gray-100">
                        <Upload size={14} />
                      </button>
                      {list.status === 'ACTIVE' && (
                        <button onClick={() => handleArchive(list.id)}
                          title="Archiver" className="p-1.5 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-gray-100">
                          <Archive size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(list.id, list.name)}
                        title="Supprimer" className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
