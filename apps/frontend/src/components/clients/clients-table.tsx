'use client';

import { Pencil, Trash2, Phone, Award } from 'lucide-react';
import { ClientQualificationBadge } from '@/components/ui/badge';
import { clsx } from 'clsx';

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  company?: string;
  address?: string;
  postalCode?: string;
  notes?: string;
  status: string;
  qualification?: string | null;
  qualifiedAt?: string | null;
  qualifiedBy?: { firstName: string; lastName: string } | null;
  assignedAgent?: { firstName: string; lastName: string };
  createdAt: string;
}

interface ClientsTableProps {
  clients: Client[];
  loading: boolean;
  userRole: string;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
  onQualify: (client: Client) => void;
}

export function ClientsTable({ clients, loading, userRole, onEdit, onDelete, onQualify }: ClientsTableProps) {
  const isManagerOrAdmin = userRole === 'ADMIN' || userRole === 'MANAGER';

  if (loading) {
    return (
      <div className="card overflow-hidden">
        <div className="p-8 text-center text-gray-400">Chargement...</div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="p-8 text-center text-gray-400">Aucun client trouvé</div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Nom', 'Téléphone', 'Email', 'Entreprise', 'Adresse', 'Code postal', 'Commentaires', 'Qualification', 'Agent', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c) => {
              const isQualified = !!c.qualification;
              const canEdit = isManagerOrAdmin || !isQualified;
              return (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                    {c.firstName} {c.lastName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                      <Phone size={13} /> {c.phone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.company ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.address ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.postalCode ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-[160px]">
                    <span className="line-clamp-2">{c.notes ?? '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ClientQualificationBadge qualification={c.qualification} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                    {c.assignedAgent ? `${c.assignedAgent.firstName} ${c.assignedAgent.lastName}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => onEdit(c)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600"
                          title="Modifier"
                        >
                          <Pencil size={15} />
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button
                          onClick={() => onQualify(c)}
                          className={clsx(
                            'p-1.5 rounded text-gray-500 transition-colors',
                            isQualified
                              ? 'hover:bg-orange-50 hover:text-orange-600'
                              : 'hover:bg-blue-50 hover:text-blue-600',
                          )}
                          title={isQualified ? 'Modifier la qualification' : 'Qualifier'}
                        >
                          <Award size={15} />
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button
                          onClick={() => onDelete(c.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
