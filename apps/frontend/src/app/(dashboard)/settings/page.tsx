'use client';

import { useEffect, useState } from 'react';
import { Save, Loader2, Shield, Bell, Globe, Key, Palette } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { clsx } from 'clsx';

type Tab = 'general' | 'security' | 'notifications' | 'integrations';

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('general');
  const [tenant, setTenant] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // General form
  const [form, setForm] = useState({ name: '', phone: '', address: '', logoUrl: '' });

  // Security form
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pwdError, setPwdError] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);

  useEffect(() => { loadTenant(); }, []);

  async function loadTenant() {
    const res = await api.get('/tenants/me').catch(() => null);
    if (res?.data) {
      const t = res.data.data ?? res.data;
      setTenant(t);
      setForm({ name: t.name ?? '', phone: t.phone ?? '', address: t.address ?? '', logoUrl: t.logoUrl ?? '' });
    }
  }

  async function saveGeneral() {
    setSaving(true); setSaved(false);
    try {
      await api.patch('/tenants/me', form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  }

  async function changePassword() {
    setPwdError('');
    if (pwdForm.newPassword !== pwdForm.confirm) { setPwdError('Les mots de passe ne correspondent pas'); return; }
    if (pwdForm.newPassword.length < 8) { setPwdError('Minimum 8 caractères'); return; }
    setPwdSaving(true);
    try {
      await api.patch('/users/me/password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setPwdSaved(true);
      setPwdForm({ currentPassword: '', newPassword: '', confirm: '' });
      setTimeout(() => setPwdSaved(false), 2000);
    } catch (e: any) {
      setPwdError(e.response?.data?.message ?? 'Erreur lors du changement');
    } finally { setPwdSaving(false); }
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'general',       label: 'Général',        icon: Globe },
    { id: 'security',      label: 'Sécurité',       icon: Shield },
    { id: 'notifications', label: 'Notifications',  icon: Bell },
    { id: 'integrations',  label: 'Intégrations',   icon: Key },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>
        <p className="text-sm text-gray-500 mt-1">Configuration de votre espace LNAYCRM</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700',
            )}>
            <t.icon size={15} /> {t.label}
          </button>
        ))}
      </div>

      {/* ── Général ── */}
      {tab === 'general' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Informations de l'entreprise</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise</label>
              <input className="input w-full" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
              <input className="input w-full" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+33 1 23 45 67 89" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
              <input className="input w-full" value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Paris, France" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">URL du logo</label>
              <input className="input w-full" value={form.logoUrl}
                onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} placeholder="https://..." />
              {form.logoUrl && (
                <img src={form.logoUrl} alt="Logo" className="mt-2 h-12 object-contain rounded" onError={e => (e.currentTarget.style.display = 'none')} />
              )}
            </div>
          </div>

          {tenant && (
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-700">Identifiant :</span> {tenant.slug}</p>
              <p><span className="font-medium text-gray-700">Plan :</span> {tenant.subscription?.plan?.name ?? '—'}</p>
              <p><span className="font-medium text-gray-700">Statut :</span> {tenant.subscription?.status ?? '—'}</p>
            </div>
          )}

          <button onClick={saveGeneral} disabled={saving}
            className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {saved ? 'Sauvegardé ✓' : 'Enregistrer'}
          </button>
        </div>
      )}

      {/* ── Sécurité ── */}
      {tab === 'security' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Changer le mot de passe</h2>
            <p className="text-sm text-gray-500">Connecté en tant que <strong>{user?.email}</strong></p>

            {pwdError && <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{pwdError}</div>}
            {pwdSaved && <div className="bg-green-50 text-green-700 text-sm rounded-lg p-3">Mot de passe modifié avec succès ✓</div>}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
                <input type="password" className="input w-full" value={pwdForm.currentPassword}
                  onChange={e => setPwdForm(f => ({ ...f, currentPassword: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                <input type="password" className="input w-full" value={pwdForm.newPassword}
                  onChange={e => setPwdForm(f => ({ ...f, newPassword: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                <input type="password" className="input w-full" value={pwdForm.confirm}
                  onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} />
              </div>
            </div>
            <button onClick={changePassword} disabled={pwdSaving || !pwdForm.currentPassword || !pwdForm.newPassword}
              className="btn-primary flex items-center gap-2">
              {pwdSaving ? <Loader2 size={15} className="animate-spin" /> : <Key size={15} />}
              Changer le mot de passe
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Informations de session</h2>
            <div className="text-sm text-gray-500 space-y-1">
              <p><span className="font-medium text-gray-700">Rôle :</span> {user?.role}</p>
              <p><span className="font-medium text-gray-700">ID utilisateur :</span> <span className="font-mono text-xs">{user?.id}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications ── */}
      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <h2 className="font-semibold text-gray-900">Préférences de notification</h2>
          {[
            { label: 'Rappels d\'appel', desc: 'Notifications pour les rappels en attente' },
            { label: 'Alertes qualité', desc: 'Appels non qualifiés et taux de contact bas' },
            { label: 'Nouvelles ventes', desc: 'Confirmation lors d\'une vente enregistrée' },
            { label: 'Nouveaux leads', desc: 'Import et affectation de nouveaux leads' },
          ].map(n => (
            <div key={n.label} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-medium text-sm text-gray-800">{n.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{n.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-5 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-600"></div>
              </label>
            </div>
          ))}
          <p className="text-xs text-gray-400">Les notifications s'affichent via le widget chatbot en temps réel.</p>
        </div>
      )}

      {/* ── Intégrations ── */}
      {tab === 'integrations' && (
        <div className="space-y-4">
          {[
            { name: 'Asterisk AMI', desc: 'Connexion au serveur de téléphonie', status: 'Connecté', ok: true },
            { name: 'Ollama LLM', desc: 'IA locale pour le chatbot agent', status: 'Actif (gemma3:1b)', ok: true },
            { name: 'Stripe', desc: 'Paiement et facturation abonnements', status: 'Non configuré', ok: false },
            { name: 'Groq API', desc: 'LLM cloud rapide (fallback Ollama)', status: 'Non configuré', ok: false },
          ].map(i => (
            <div key={i.name} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
              <div className={clsx(
                'w-2.5 h-2.5 rounded-full shrink-0',
                i.ok ? 'bg-green-500' : 'bg-gray-300',
              )} />
              <div className="flex-1">
                <p className="font-semibold text-sm text-gray-900">{i.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{i.desc}</p>
              </div>
              <span className={clsx(
                'text-xs px-2.5 py-1 rounded-full font-medium',
                i.ok ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
              )}>
                {i.status}
              </span>
            </div>
          ))}
          <p className="text-xs text-gray-400 px-1">Pour configurer Stripe ou Groq, ajoutez les clés dans le fichier <code className="font-mono bg-gray-100 px-1 rounded">.env</code> du backend.</p>
        </div>
      )}
    </div>
  );
}
