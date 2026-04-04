'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Users, Plus, Pencil, KeyRound, Power, Monitor,
  Loader2, Check, X, Search, Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface UserItem {
  id: string; email: string; firstName: string; lastName: string;
  role: string; isActive: boolean; lastLoginAt?: string; createdAt: string;
}
interface Session {
  id: string; ip?: string; userAgent?: string; lastSeenAt: string; createdAt: string;
  user: { id: string; firstName: string; lastName: string; email: string; role: string };
}

const ROLE_LABELS: Record<string, string> = { ADMIN: 'Admin', MANAGER: 'Manager', AGENT: 'Agent' };
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  AGENT: 'bg-gray-100 text-gray-600',
};

type Tab = 'users' | 'sessions';

interface UserFormData {
  email: string; firstName: string; lastName: string; role: string; password: string;
}

function UserModal({ user, onClose, onSaved }: {
  user?: UserItem; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState<UserFormData>({
    email: user?.email ?? '',
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
    role: user?.role ?? 'AGENT',
    password: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setSaving(true); setError('');
    try {
      if (user) {
        await api.patch(`/users/${user.id}`, { firstName: form.firstName, lastName: form.lastName, role: form.role });
      } else {
        if (!form.password) { setError('Mot de passe requis'); setSaving(false); return; }
        await api.post('/users', form);
      }
      onSaved();
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          {user ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </h2>
        {error && <p className="text-sm text-red-600 bg-red-50 rounded px-3 py-2">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Prénom</label>
            <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
              className="input-field mt-1 w-full" />
          </div>
          <div>
            <label className="label">Nom</label>
            <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
              className="input-field mt-1 w-full" />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            disabled={!!user}
            className="input-field mt-1 w-full disabled:opacity-60" />
        </div>
        <div>
          <label className="label">Rôle</label>
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            className="input-field mt-1 w-full">
            <option value="AGENT">Agent</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {!user && (
          <div>
            <label className="label">Mot de passe</label>
            <input type="password" value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Min. 8 caractères" className="input-field mt-1 w-full" />
          </div>
        )}
        <div className="flex gap-2 pt-2">
          <button onClick={save} disabled={saving || !form.firstName || !form.email}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {user ? 'Enregistrer' : 'Créer'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onClose }: { user: UserItem; onClose: () => void }) {
  const [pwd, setPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const reset = async () => {
    if (!pwd || pwd.length < 6) return;
    setSaving(true);
    try {
      await api.post(`/users/${user.id}/reset-password`, { password: pwd });
      setDone(true);
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Réinitialiser le mot de passe</h2>
        <p className="text-sm text-gray-500">{user.firstName} {user.lastName} — {user.email}</p>
        {done ? (
          <div className="text-center py-4">
            <Check size={32} className="mx-auto text-green-500 mb-2" />
            <p className="text-sm text-gray-700">Mot de passe mis à jour</p>
          </div>
        ) : (
          <>
            <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
              placeholder="Nouveau mot de passe" className="input-field w-full" />
            <div className="flex gap-2">
              <button onClick={reset} disabled={saving || pwd.length < 6}
                className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Réinitialiser
              </button>
              <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
            </div>
          </>
        )}
        {done && <button onClick={onClose} className="btn-secondary w-full">Fermer</button>}
      </div>
    </div>
  );
}

export default function UsersPage() {
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | undefined>();
  const [resetUser, setResetUser] = useState<UserItem | undefined>();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (search) params.set('search', search);
      const res = await api.get(`/users?${params}`);
      setUsers(res.data.data ?? []);
      setTotal(res.data.meta?.total ?? 0);
    } finally { setLoading(false); }
  }, [search]);

  const loadSessions = useCallback(async () => {
    try {
      const res = await api.get('/sessions');
      setSessions(res.data.data ?? res.data ?? []);
    } catch { setSessions([]); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);
  useEffect(() => { if (tab === 'sessions') loadSessions(); }, [tab, loadSessions]);

  const toggleActive = async (u: UserItem) => {
    await api.patch(`/users/${u.id}/toggle-active`);
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, isActive: !u.isActive } : x));
  };

  const forceLogout = async (sessionId: string) => {
    await api.delete(`/sessions/${sessionId}`);
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const forceLogoutUser = async (userId: string) => {
    if (!confirm('Déconnecter toutes les sessions de cet utilisateur ?')) return;
    await api.delete(`/sessions/user/${userId}`);
    loadSessions();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Équipe & Sessions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} utilisateur{total !== 1 ? 's' : ''}</p>
        </div>
        {tab === 'users' && (
          <button onClick={() => { setEditUser(undefined); setShowModal(true); }}
            className="btn-primary flex items-center gap-2">
            <Plus size={15} /> Nouvel utilisateur
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-1">
        {([
          { key: 'users', label: 'Utilisateurs', icon: <Users size={14} /> },
          { key: 'sessions', label: 'Sessions actives', icon: <Monitor size={14} /> },
        ] as { key: Tab; label: string; icon: React.ReactNode }[]).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={clsx('flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-500 hover:text-gray-700')}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Tab: Users */}
      {tab === 'users' && (
        <>
          <div className="relative max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher…" className="input-field pl-9 w-full text-sm" />
          </div>

          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Utilisateur', 'Email', 'Rôle', 'Statut', 'Dernière connexion', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 text-sm flex items-center justify-center font-bold">
                            {u.firstName[0]}{u.lastName[0]}
                          </div>
                          <span className="font-medium text-gray-900">{u.firstName} {u.lastName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[u.role])}>
                          {ROLE_LABELS[u.role] ?? u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                          u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {u.isActive ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('fr-FR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => { setEditUser(u); setShowModal(true); }}
                            title="Modifier" className="p-1.5 text-gray-400 hover:text-primary-600 rounded">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setResetUser(u)}
                            title="Réinitialiser MDP" className="p-1.5 text-gray-400 hover:text-yellow-600 rounded">
                            <KeyRound size={14} />
                          </button>
                          <button onClick={() => toggleActive(u)}
                            title={u.isActive ? 'Désactiver' : 'Activer'}
                            className={clsx('p-1.5 rounded', u.isActive ? 'text-gray-400 hover:text-red-500' : 'text-gray-400 hover:text-green-600')}>
                            <Power size={14} />
                          </button>
                          <button onClick={() => forceLogoutUser(u.id)}
                            title="Déconnecter" className="p-1.5 text-gray-400 hover:text-orange-500 rounded">
                            <Activity size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* Tab: Sessions */}
      {tab === 'sessions' && (
        <div className="card overflow-hidden">
          {sessions.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Monitor size={36} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm">Aucune session active</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Utilisateur', 'Rôle', 'IP', 'Navigateur', 'Vu le', ''].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-700 text-xs flex items-center justify-center font-bold">
                          {s.user.firstName[0]}{s.user.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-xs">{s.user.firstName} {s.user.lastName}</div>
                          <div className="text-gray-400 text-xs">{s.user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[s.user.role])}>
                        {ROLE_LABELS[s.user.role]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 font-mono">{s.ip ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{s.userAgent ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(s.lastSeenAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => forceLogout(s.id)}
                        title="Terminer la session" className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                        <X size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {showModal && (
        <UserModal
          user={editUser}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadUsers(); }}
        />
      )}
      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(undefined)} />
      )}
    </div>
  );
}
