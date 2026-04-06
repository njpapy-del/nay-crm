'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Search, MoreVertical, Shield, UserCheck, UserX, Key,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { useAuthStore } from '@/stores/auth.store';

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  ADMIN:   { label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  MANAGER: { label: 'Manager', color: 'bg-blue-100 text-blue-700' },
  AGENT:   { label: 'Agent', color: 'bg-green-100 text-green-700' },
  QUALITY: { label: 'Qualité', color: 'bg-orange-100 text-orange-700' },
};

function UserModal({ onClose, onSaved, tenantId }: { onClose: () => void; onSaved: () => void; tenantId: string }) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', role: 'AGENT' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save() {
    setSaving(true); setError('');
    try {
      await api.post('/users', form);
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-5">Créer un utilisateur</h2>
        {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3 mb-4">{error}</div>}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
              <input className="input w-full text-sm" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
              <input className="input w-full text-sm" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input className="input w-full text-sm" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Mot de passe temporaire</label>
            <input className="input w-full text-sm" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Rôle</label>
            <select className="input w-full text-sm" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Annuler
          </button>
          <button onClick={save} disabled={saving || !form.email || !form.password}
            className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />} Créer
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { user: me } = useAuthStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [quota, setQuota] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const [usersRes, quotaRes] = await Promise.all([
        api.get('/users'),
        api.get('/tenants/me/quota/agents'),
      ]);
      setUsers(usersRes.data.data ?? usersRes.data ?? []);
      setQuota(quotaRes.data.data ?? quotaRes.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(userId: string) {
    setActing(userId);
    try { await api.patch(`/users/${userId}/toggle-active`); await load(); }
    finally { setActing(null); }
  }

  async function resetPwd(userId: string) {
    const newPwd = prompt('Nouveau mot de passe (min 8 caractères):');
    if (!newPwd) return;
    setActing(userId);
    try { await api.post(`/users/${userId}/reset-password`, { newPassword: newPwd }); }
    finally { setActing(null); }
  }

  const filtered = users.filter((u) =>
    !search || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Équipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {quota ? `${quota.current}/${quota.max} agents utilisés` : ''}
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={15} /> Ajouter un utilisateur
        </button>
      </div>

      {quota && (
        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
          <div className="bg-primary-500 h-2 rounded-full transition-all"
            style={{ width: `${Math.min(100, (quota.current / quota.max) * 100)}%` }} />
        </div>
      )}

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9 w-full sm:w-72 text-sm" placeholder="Rechercher..." value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Utilisateur', 'Rôle', 'Email', 'Statut', 'Actions'].map((h) => (
                <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u: any) => {
              const roleDef = ROLE_LABELS[u.role] ?? ROLE_LABELS.AGENT;
              return (
                <tr key={u.id} className={clsx('hover:bg-gray-50', !u.isActive && 'opacity-50')}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-700">
                        {u.firstName?.[0]}{u.lastName?.[0]}
                      </div>
                      <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={clsx('text-xs font-semibold px-2 py-0.5 rounded-full', roleDef.color)}>
                      {roleDef.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className={clsx('text-xs font-medium', u.isActive ? 'text-green-600' : 'text-gray-400')}>
                      {u.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {u.id !== me?.id && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleActive(u.id)} disabled={!!acting}
                          title={u.isActive ? 'Désactiver' : 'Activer'}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          {acting === u.id ? <Loader2 size={14} className="animate-spin" /> : u.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button onClick={() => resetPwd(u.id)} disabled={!!acting}
                          title="Réinitialiser mot de passe"
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                          <Key size={14} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Aucun utilisateur trouvé</div>
        )}
      </div>

      {showModal && <UserModal onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load(); }} tenantId={me?.tenantId ?? ''} />}
    </div>
  );
}
