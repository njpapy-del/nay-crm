'use client';

import { Pencil, Trash2, Phone } from 'lucide-react';
import { ClientStatusBadge } from '@/components/ui/badge';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  company?: string;
  status: string;
  assignedAgent?: { firstName: string; lastName: string };
  createdAt: string;
}

interface ClientsTableProps {
  clients: Client[];
  loading: boolean;
  onEdit: (client: Client) => void;
  onDelete: (id: string) => void;
}

export function ClientsTable({ clients, loading, onEdit, onDelete }: ClientsTableProps) {
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
              {['Nom', 'Téléphone', 'Email', 'Entreprise', 'Statut', 'Agent', 'Actions'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {c.firstName} {c.lastName}
                </td>
                <td className="px-4 py-3">
                  <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-primary-600 hover:underline">
                    <Phone size={13} /> {c.phone}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-600">{c.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.company ?? '—'}</td>
                <td className="px-4 py-3"><ClientStatusBadge status={c.status} /></td>
                <td className="px-4 py-3 text-gray-600">
                  {c.assignedAgent ? `${c.assignedAgent.firstName} ${c.assignedAgent.lastName}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(c)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-primary-600">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => onDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
