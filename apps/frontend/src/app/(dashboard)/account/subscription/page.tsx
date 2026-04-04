'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Zap, ArrowUpRight } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

const STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  TRIAL:     { label: 'Essai gratuit', color: 'bg-blue-100 text-blue-700', icon: Zap },
  ACTIVE:    { label: 'Actif', color: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  PAST_DUE:  { label: 'Paiement en retard', color: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  SUSPENDED: { label: 'Suspendu', color: 'bg-red-100 text-red-700', icon: XCircle },
  CANCELLED: { label: 'Annulé', color: 'bg-gray-100 text-gray-600', icon: XCircle },
};

const PLANS = [
  { code: 'BASIC', name: 'Basic', price: '49€', agents: 5, calls: '2 000' },
  { code: 'PRO', name: 'Pro', price: '149€', agents: 20, calls: '10 000', recommended: true },
  { code: 'ENTERPRISE', name: 'Enterprise', price: '399€', agents: '∞', calls: '∞' },
];

export default function SubscriptionPage() {
  const [sub, setSub] = useState<any>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [subRes, plansRes] = await Promise.all([
        api.get('/subscriptions/me'),
        api.get('/subscriptions/plans'),
      ]);
      setSub(subRes.data.data ?? subRes.data);
      setPlans(plansRes.data.data ?? plansRes.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function changePlan(code: string) {
    setActing(true);
    try {
      await api.post('/subscriptions/subscribe', { plan: code });
      await load();
    } finally { setActing(false); }
  }

  async function cancelSub() {
    if (!confirm('Annuler votre abonnement à la fin de la période ?')) return;
    setActing(true);
    try { await api.post('/subscriptions/cancel'); await load(); }
    finally { setActing(false); }
  }

  async function reactivate() {
    setActing(true);
    try { await api.post('/subscriptions/reactivate'); await load(); }
    finally { setActing(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={28} className="animate-spin text-primary-400" /></div>;

  const statusDef = STATUS_LABELS[sub?.status ?? 'TRIAL'];
  const StatusIcon = statusDef?.icon ?? Zap;
  const currentPlanCode = sub?.plan?.code;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Abonnement</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gérez votre plan et votre facturation</p>
      </div>

      {/* Current subscription card */}
      {sub ? (
        <div className="card p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={clsx('text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5', statusDef?.color)}>
                  <StatusIcon size={12} /> {statusDef?.label}
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mt-2">Plan {sub.plan?.name}</h3>
              <p className="text-gray-500 text-sm mt-0.5">
                {sub.daysLeft > 0 ? `${sub.daysLeft} jours restants` : 'Expiré'}
                {' · '}Renouvellement le {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-gray-900">{sub.plan?.priceMonthly}€</p>
              <p className="text-xs text-gray-400">/ mois</p>
            </div>
          </div>

          {/* Limits */}
          <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-gray-100">
            {[
              { label: 'Agents max', val: sub.plan?.maxAgents >= 999 ? '∞' : sub.plan?.maxAgents },
              { label: 'Appels/mois', val: sub.plan?.maxCalls >= 999999 ? '∞' : sub.plan?.maxCalls?.toLocaleString() },
              { label: 'Stockage', val: `${Math.round((sub.plan?.maxStorage ?? 0) / 1024)} Go` },
            ].map((l) => (
              <div key={l.label} className="text-center">
                <p className="text-lg font-bold text-gray-900">{l.val}</p>
                <p className="text-xs text-gray-500">{l.label}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-100">
            {sub.cancelAtPeriodEnd ? (
              <button onClick={reactivate} disabled={acting} className="btn-primary text-sm flex items-center gap-1.5">
                {acting ? <Loader2 size={14} className="animate-spin" /> : null} Réactiver l'abonnement
              </button>
            ) : (
              <button onClick={cancelSub} disabled={acting}
                className="text-sm px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                Annuler en fin de période
              </button>
            )}
          </div>

          {sub.cancelAtPeriodEnd && (
            <p className="text-sm text-orange-600 bg-orange-50 rounded-lg p-3 mt-3">
              Votre abonnement sera annulé le {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
      ) : (
        <div className="card p-6 text-center text-gray-400">Aucun abonnement actif</div>
      )}

      {/* Change plan */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Changer de plan</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(plans.length ? plans : PLANS).map((plan: any) => {
            const isCurrent = plan.code === currentPlanCode;
            return (
              <div key={plan.code} className={clsx(
                'card p-5 border-2 transition-all',
                isCurrent ? 'border-primary-500 bg-primary-50' : 'border-gray-100 hover:border-gray-300',
              )}>
                {plan.recommended && !isCurrent && (
                  <div className="text-xs bg-primary-100 text-primary-700 font-semibold px-2 py-0.5 rounded-full inline-block mb-2">Recommandé</div>
                )}
                <h3 className="font-bold text-gray-900">{plan.name}</h3>
                <p className="text-2xl font-bold text-primary-600 mt-1">{plan.priceMonthly ?? plan.price}€<span className="text-sm font-normal text-gray-400">/mois</span></p>
                <ul className="mt-3 space-y-1 text-xs text-gray-500">
                  <li>{plan.maxAgents >= 999 ? '∞' : plan.maxAgents} agents</li>
                  <li>{plan.maxCalls >= 999999 ? '∞' : (plan.maxCalls ?? 0).toLocaleString()} appels/mois</li>
                </ul>
                {isCurrent ? (
                  <div className="mt-4 text-xs font-semibold text-primary-600 flex items-center gap-1">
                    <CheckCircle2 size={14} /> Plan actuel
                  </div>
                ) : (
                  <button onClick={() => changePlan(plan.code)} disabled={acting}
                    className="mt-4 w-full text-sm px-3 py-1.5 rounded-lg border border-primary-500 text-primary-600 hover:bg-primary-50 transition-colors flex items-center justify-center gap-1 font-medium">
                    Choisir <ArrowUpRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
