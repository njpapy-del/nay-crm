'use client';

import { useCallback, useEffect, useState } from 'react';
import { History, CheckCircle, XCircle, Clock, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface ImportHistory {
  id: string; fileName: string; status: string;
  totalRows: number; importedRows: number; skippedRows: number;
  errorRows: number; duplicates: number;
  createdAt: string; completedAt?: string;
  list: { id: string; name: string };
  createdBy: { firstName: string; lastName: string };
  errors?: { row: number; message: string }[];
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  COMPLETED: <CheckCircle size={14} className="text-green-500" />,
  FAILED:    <XCircle size={14} className="text-red-500" />,
  PROCESSING:<Loader2 size={14} className="text-blue-500 animate-spin" />,
  PENDING:   <Clock size={14} className="text-gray-400" />,
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: 'Terminé', FAILED: 'Échoué', PROCESSING: 'En cours', PENDING: 'En attente',
};

export default function ImportsHistoryPage() {
  const [data, setData] = useState<ImportHistory[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/imports/history?page=${page}&limit=20`);
      setData(res.data.data);
      setTotal(res.data.total);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historique des imports</h1>
        <p className="text-sm text-gray-500 mt-0.5">{total} import{total !== 1 ? 's' : ''}</p>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
        ) : data.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <History size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun import</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Fichier', 'Liste', 'Utilisateur', 'Total', 'Importés', 'Doublons', 'Erreurs', 'Statut', 'Date', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((imp) => (
                <>
                  <tr key={imp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[180px] truncate">
                      {imp.fileName}
                    </td>
                    <td className="px-4 py-3 text-xs text-primary-600">{imp.list.name}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {imp.createdBy.firstName} {imp.createdBy.lastName}
                    </td>
                    <td className="px-4 py-3 text-center font-medium">{imp.totalRows}</td>
                    <td className="px-4 py-3 text-center text-green-600 font-medium">{imp.importedRows}</td>
                    <td className="px-4 py-3 text-center text-yellow-600">{imp.duplicates}</td>
                    <td className="px-4 py-3 text-center text-red-500">{imp.errorRows}</td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 text-xs font-medium">
                        {STATUS_ICONS[imp.status]}
                        {STATUS_LABELS[imp.status] ?? imp.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(imp.createdAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      {imp.errors && imp.errors.length > 0 && (
                        <button onClick={() => setExpanded(expanded === imp.id ? null : imp.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded">
                          {expanded === imp.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === imp.id && imp.errors && (
                    <tr key={`${imp.id}-err`}>
                      <td colSpan={10} className="px-6 pb-3">
                        <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700 space-y-1">
                          <p className="font-semibold mb-1">Erreurs de ce fichier :</p>
                          {imp.errors.slice(0, 20).map((e, i) => (
                            <p key={i}>Ligne {e.row} : {e.message}</p>
                          ))}
                          {imp.errors.length > 20 && (
                            <p className="text-red-400">… et {imp.errors.length - 20} autres erreurs</p>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page}/{totalPages}</span>
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
