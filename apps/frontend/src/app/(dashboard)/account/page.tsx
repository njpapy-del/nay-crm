'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export default function AccountPage() {
  const { user } = useAuthStore();
  const [tenant, setTenant] = useState<any>(null);
  const [form, setForm] = useState({ name: '', address: '', phone: '', logoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/tenants/me');
      const t = res.data.data ?? res.data;
      setTenant(t);
      setForm({ name: t.name ?? '', address: t.address ?? '', phone: t.phone ?? '', logoUrl: t.logoUrl ?? '' });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await api.patch('/tenants/me', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil de l'entreprise</h1>
        <p className="text-sm text-gray-500 mt-0.5">Informations de votre organisation</p>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
          <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center">
            <Building2 size={28} className="text-primary-600" />
          </div>
          <div>
            <p className="font-bold text-lg text-gray-900">{tenant?.name}</p>
            <p className="text-sm text-gray-400 font-mono">/{tenant?.slug}</p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
          <input className="input w-full" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input className="input w-full" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
          <input className="input w-full" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">URL du logo</label>
          <input className="input w-full" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={saving}
            className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Enregistrer
          </button>
          {saved && <span className="text-sm text-green-600 font-medium">✓ Sauvegardé</span>}
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Utilisateurs', val: tenant?._count?.users ?? 0 },
          { label: 'Clients', val: tenant?._count?.clients ?? 0 },
          { label: 'Campagnes', val: tenant?._count?.campaigns ?? 0 },
        ].map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{s.val}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
