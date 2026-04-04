'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Download, Search, Filter,
  Phone, Mail, RefreshCw, Loader2, CheckSquare, Square,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Contact {
  id: string; firstName?: string; lastName?: string; phone: string;
  email?: string; company?: string; status: string;
  attemptCount: number; lastCalledAt?: string; isBlacklisted: boolean;
}

interface ListDetail {
  id: string; name: string; source?: string; status: string;
  totalContacts: number; campaign?: { name: string };
}

const STATUS_COLORS: Record<string, string> = {
  NEW:          'bg-gray-100 text-gray-600',
  CALLED:       'bg-blue-100 text-blue-700',
  CALLBACK:     'bg-yellow-100 text-yellow-700',
  REFUSED:      'bg-red-100 text-red-700',
  OUT_OF_TARGET:'bg-orange-100 text-orange-700',
  RECYCLED:     'bg-purple-100 text-purple-700',
  CONVERTED:    'bg-green-100 text-green-700',
  DNC:          'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Nouveau', CALLED: 'Appelé', CALLBACK: 'À rappeler',
  REFUSED: 'Refusé', OUT_OF_TARGET: 'Hors cible',
  RECYCLED: 'Recyclé', CONVERTED: 'Converti', DNC: 'DNC',
};

const BULK_STATUSES = ['CALLED', 'CALLBACK', 'REFUSED', 'OUT_OF_TARGET', 'RECYCLED', 'DNC'];

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [list, setList] = useState<ListDetail | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [applying, setApplying] = useState(false);
  const LIMIT = 50;

  const loadList = useCallback(async () => {
    const res = await api.get(`/lists/${id}`);
    setList(res.data);
  }, [id]);

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const res = await api.get(`/contacts/list/${id}?${params}`);
      setContacts(res.data.data);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  }, [id, page, search, statusFilter]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadContacts(); }, [loadContacts]);

  const toggleSelect = (cid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(cid) ? next.delete(cid) : next.add(cid);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === contacts.length) setSelected(new Set());
    else setSelected(new Set(contacts.map((c) => c.id)));
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selected.size === 0) return;
    setApplying(true);
    try {
      await api.post('/contacts/bulk-status', { ids: [...selected], status: bulkStatus });
      setSelected(new Set()); setBulkStatus('');
      loadContacts();
    } finally { setApplying(false); }
  };

  const handleExport = async () => {
    const params = new URLSearchParams({ limit: '100000' });
    if (statusFilter) params.set('status', statusFilter);
    const res = await api.get(`/contacts/list/${id}/export?${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url;
    a.download = `contacts-${id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/lists')}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{list?.name ?? '…'}</h1>
            <p className="text-xs text-gray-400">
              {total.toLocaleString()} contact{total !== 1 ? 's' : ''}
              {list?.campaign && <> · {list.campaign.name}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Exporter CSV
          </button>
          <button onClick={() => router.push(`/lists/import?listId=${id}`)}
            className="btn-primary flex items-center gap-2 text-sm">
            <Upload size={14} /> Importer
          </button>
        </div>
      </div>

      {/* Filtres + actions bulk */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Nom, téléphone, email…"
            className="input-field pl-8 text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="input-field text-sm w-40">
          <option value="">Tous statuts</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs text-gray-500">{selected.size} sélectionné(s)</span>
            <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}
              className="input-field text-xs w-36">
              <option value="">Changer statut…</option>
              {BULK_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button onClick={applyBulkStatus} disabled={!bulkStatus || applying}
              className="btn-primary text-xs flex items-center gap-1 disabled:opacity-50">
              {applying ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Appliquer
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">Aucun contact trouvé</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 w-8">
                  <button onClick={toggleAll}>
                    {selected.size === contacts.length && contacts.length > 0
                      ? <CheckSquare size={15} className="text-primary-600" />
                      : <Square size={15} className="text-gray-300" />}
                  </button>
                </th>
                {['Nom', 'Téléphone', 'Email', 'Société', 'Statut', 'Tentatives', 'Dernier appel'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {contacts.map((c) => (
                <tr key={c.id} className={clsx('hover:bg-gray-50', selected.has(c.id) && 'bg-primary-50')}>
                  <td className="px-3 py-3">
                    <button onClick={() => toggleSelect(c.id)}>
                      {selected.has(c.id)
                        ? <CheckSquare size={15} className="text-primary-600" />
                        : <Square size={15} className="text-gray-300" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || <span className="text-gray-300">—</span>}
                    {c.isBlacklisted && (
                      <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">BL</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    <a href={`tel:${c.phone}`} className="hover:text-primary-600 flex items-center gap-1">
                      <Phone size={11} /> {c.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {c.email
                      ? <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-primary-600"><Mail size={11} /> {c.email}</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.company ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                      STATUS_COLORS[c.status] ?? 'bg-gray-100 text-gray-600')}>
                      {STATUS_LABELS[c.status] ?? c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-center text-gray-500">{c.attemptCount}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.lastCalledAt
                      ? new Date(c.lastCalledAt).toLocaleDateString('fr-FR')
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">
            Page {page}/{totalPages} · {total.toLocaleString()} contacts
          </span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs disabled:opacity-40">Préc.</button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      )}
    </div>
  );
}
