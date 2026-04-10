'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { ClientsTable, Client } from '@/components/clients/clients-table';
import { ClientFormModal } from '@/components/clients/client-form-modal';
import { QualifyModal } from '@/components/clients/qualify-modal';

interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ClientsPage() {
  const { user } = useAuthStore();
  const userRole = user?.role ?? 'AGENT';
  const isManagerOrAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';

  const [clients, setClients] = useState<Client[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [qualifyingClient, setQualifyingClient] = useState<Client | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/clients', { params: { page, limit: 20, search: search || undefined } });
      setClients(res.data.data);
      setMeta(res.data.meta);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchClients(); }, [fetchClients]);
  useEffect(() => { setPage(1); }, [search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ?')) return;
    await api.delete(`/clients/${id}`);
    fetchClients();
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingClient(null);
    fetchClients();
  };

  const handleQualified = () => {
    setQualifyingClient(null);
    fetchClients();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{meta?.total ?? 0} clients au total</p>
        </div>
        {isManagerOrAdmin && (
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> Nouveau client
          </button>
        )}
      </div>

      {/* Search */}
      <div className="card p-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field pl-9"
            placeholder="Rechercher par nom, téléphone, email..."
          />
        </div>
      </div>

      {/* Table */}
      <ClientsTable
        clients={clients}
        loading={loading}
        userRole={userRole}
        onEdit={(c) => { setEditingClient(c); setShowModal(true); }}
        onDelete={handleDelete}
        onQualify={(c) => setQualifyingClient(c)}
      />

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600">
            Page {page} / {meta.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page === meta.totalPages}
            className="btn-secondary px-3 py-1.5 text-sm"
          >
            Suivant
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {showModal && (
        <ClientFormModal
          client={editingClient}
          userRole={userRole}
          onClose={() => { setShowModal(false); setEditingClient(null); }}
          onSaved={handleSaved}
        />
      )}

      {/* Qualify Modal */}
      {qualifyingClient && (
        <QualifyModal
          client={qualifyingClient}
          onClose={() => setQualifyingClient(null)}
          onSaved={handleQualified}
        />
      )}
    </div>
  );
}
