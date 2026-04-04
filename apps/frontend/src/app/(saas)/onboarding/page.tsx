'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Building2, User, CreditCard, CheckCircle2, Loader2 } from 'lucide-react';
import { api, setTokens } from '@/lib/api';

// ─── Steps ───────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Entreprise', icon: Building2 },
  { id: 2, label: 'Admin',     icon: User },
  { id: 3, label: 'Plan',      icon: CreditCard },
  { id: 4, label: 'Terminé',   icon: CheckCircle2 },
];

const PLANS = [
  {
    code: 'BASIC', name: 'Basic', price: '49€/mois',
    features: ['5 agents', '2 000 appels/mois', 'Campagnes, Leads, Agenda'],
    color: 'border-gray-200',
  },
  {
    code: 'PRO', name: 'Pro', price: '149€/mois',
    features: ['20 agents', '10 000 appels/mois', 'Analytics, KPI, Rapports', 'Enregistrements, Supervision'],
    color: 'border-primary-500',
    recommended: true,
  },
  {
    code: 'ENTERPRISE', name: 'Enterprise', price: '399€/mois',
    features: ['Agents illimités', 'Appels illimités', 'Tous les modules', 'Support dédié'],
    color: 'border-purple-500',
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [company, setCompany] = useState({ name: '', slug: '', phone: '', address: '' });
  const [admin, setAdmin] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [selectedPlan, setSelectedPlan] = useState('PRO');
  const [tenantId, setTenantId] = useState('');

  // ── Step 1: créer le tenant ──────────────────────────────────────────
  async function submitCompany() {
    setLoading(true); setError('');
    try {
      const res = await api.post('/tenants', company);
      setTenantId(res.data.data?.id ?? res.data.id);
      setStep(2);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors de la création');
    } finally { setLoading(false); }
  }

  // ── Step 2: créer l'admin ────────────────────────────────────────────
  async function submitAdmin() {
    setLoading(true); setError('');
    try {
      await api.post('/auth/onboard-admin', { ...admin, tenantId });
      setStep(3);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors de la création du compte');
    } finally { setLoading(false); }
  }

  // ── Step 3: choisir le plan ──────────────────────────────────────────
  async function submitPlan() {
    setLoading(true); setError('');
    try {
      // Login d'abord pour avoir le token
      const loginRes = await api.post('/auth/login', { email: admin.email, password: admin.password });
      const accessToken = loginRes.data.data?.accessToken ?? loginRes.data.accessToken;
      const refreshToken = loginRes.data.data?.refreshToken ?? loginRes.data.refreshToken;
      setTokens(accessToken, refreshToken);

      await api.post('/subscriptions/subscribe', { plan: selectedPlan });
      setStep(4);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors de la souscription');
    } finally { setLoading(false); }
  }

  function goToDashboard() { router.push('/dashboard'); }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Bienvenue sur LNAYCRM</h1>
          <p className="text-gray-500 mt-2">Créez votre espace en quelques étapes</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={clsx(
                'flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold transition-colors',
                step > s.id ? 'bg-green-500 text-white' :
                step === s.id ? 'bg-primary-600 text-white' :
                'bg-gray-200 text-gray-400',
              )}>
                {step > s.id ? <CheckCircle2 size={16} /> : s.id}
              </div>
              <span className={clsx('text-sm font-medium hidden sm:block', step === s.id ? 'text-primary-600' : 'text-gray-400')}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className={clsx('w-8 h-px', step > s.id ? 'bg-green-400' : 'bg-gray-300')} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && <div className="bg-red-50 text-red-700 rounded-lg p-3 text-sm mb-4">{error}</div>}

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Votre entreprise</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de l'entreprise *</label>
                <input className="input w-full" value={company.name} onChange={(e) => {
                  const name = e.target.value;
                  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
                  setCompany((c) => ({ ...c, name, slug }));
                }} placeholder="Acme Corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Identifiant unique *</label>
                <input className="input w-full font-mono text-sm" value={company.slug}
                  onChange={(e) => setCompany((c) => ({ ...c, slug: e.target.value }))}
                  placeholder="acme-corp" />
                <p className="text-xs text-gray-400 mt-1">Utilisé pour l'URL. Lettres minuscules et tirets uniquement.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                  <input className="input w-full" value={company.phone} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} placeholder="+33 1 23 45 67 89" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                  <input className="input w-full" value={company.address} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} placeholder="Paris, France" />
                </div>
              </div>
              <button onClick={submitCompany} disabled={!company.name || !company.slug || loading}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />} Continuer
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Compte administrateur</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                  <input className="input w-full" value={admin.firstName} onChange={(e) => setAdmin((a) => ({ ...a, firstName: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
                  <input className="input w-full" value={admin.lastName} onChange={(e) => setAdmin((a) => ({ ...a, lastName: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input className="input w-full" type="email" value={admin.email} onChange={(e) => setAdmin((a) => ({ ...a, email: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe *</label>
                <input className="input w-full" type="password" value={admin.password} onChange={(e) => setAdmin((a) => ({ ...a, password: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-1">Minimum 8 caractères</p>
              </div>
              <button onClick={submitAdmin} disabled={!admin.email || !admin.password || !admin.firstName || loading}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />} Continuer
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-6">Choisissez votre plan</h2>
              <div className="grid grid-cols-1 gap-4 mb-6">
                {PLANS.map((plan) => (
                  <label key={plan.code} className={clsx(
                    'flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all',
                    selectedPlan === plan.code ? plan.color + ' bg-primary-50' : 'border-gray-100 hover:border-gray-300',
                  )}>
                    <input type="radio" name="plan" value={plan.code} checked={selectedPlan === plan.code}
                      onChange={() => setSelectedPlan(plan.code)} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{plan.name}</span>
                        {plan.recommended && <span className="text-xs px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full font-medium">Recommandé</span>}
                      </div>
                      <p className="text-primary-600 font-semibold mt-0.5">{plan.price}</p>
                      <ul className="mt-2 space-y-1">
                        {plan.features.map((f) => <li key={f} className="text-xs text-gray-500 flex items-center gap-1.5"><CheckCircle2 size={12} className="text-green-500 shrink-0" />{f}</li>)}
                      </ul>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 text-center mb-4">Essai gratuit 14 jours · Aucune carte requise</p>
              <button onClick={submitPlan} disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />} Démarrer l'essai gratuit
              </button>
            </div>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 size={40} className="text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Votre espace est prêt !</h2>
              <p className="text-gray-500 mb-8">Bienvenue sur LNAYCRM. Votre essai de 14 jours commence maintenant.</p>
              <button onClick={goToDashboard} className="btn-primary px-8">
                Accéder au tableau de bord
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
