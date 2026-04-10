'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';
import { Plus, X, CheckCircle, XCircle, Clock } from 'lucide-react';
import { clsx } from 'clsx';

type ReqType = 'ABSENCE' | 'FORMATION' | 'CONGE';
type ReqStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface HrRequest {
  id: string; type: ReqType; status: ReqStatus;
  startDate: string; endDate: string; comment?: string; reviewComment?: string; reviewedAt?: string;
  agent: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string };
}

const STATUS_STYLES: Record<ReqStatus, { label: string; cls: string; icon: any }> = {
  PENDING:  { label: 'En attente', cls: 'bg-yellow-100 text-yellow-700', icon: Clock },
  APPROVED: { label: 'Acceptée',   cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
  REJECTED: { label: 'Refusée',    cls: 'bg-red-100 text-red-600',      icon: XCircle },
};

const TYPE_LABELS: Record<ReqType, string> = { ABSENCE: 'Absence', FORMATION: 'Formation', CONGE: 'Congé' };

function NewRequestModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<ReqType>('CONGE');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!startDate || !endDate) return;
    setSaving(true);
    try {
      await api.post('/hr/requests', { type, startDate, endDate, comment });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Nouvelle demande</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div>
          <label className="label text-xs mb-2">Type</label>
          <div className="flex gap-2">
            {(['ABSENCE', 'FORMATION', 'CONGE'] as ReqType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={clsx('flex-1 py-2 rounded-lg text-xs font-medium border-2 transition-colors',
                  type === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600')}>
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label text-xs mb-1">Date début</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-field text-sm" />
          </div>
          <div>
            <label className="label text-xs mb-1">Date fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-field text-sm" />
          </div>
        </div>
        <div>
          <label className="label text-xs mb-1">Commentaire</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} className="input-field text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={save} disabled={saving || !startDate || !endDate}
            className="btn-primary text-sm disabled:opacity-50">{saving ? 'Envoi...' : 'Envoyer'}</button>
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ req, onClose, onSaved }: { req: HrRequest; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<'APPROVED' | 'REJECTED'>('APPROVED');
  const [reviewComment, setReviewComment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.patch(`/hr/requests/${req.id}/review`, { status, reviewComment });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Traiter la demande</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
          <p><strong>{req.agent.firstName} {req.agent.lastName}</strong> — {TYPE_LABELS[req.type]}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(req.startDate).toLocaleDateString('fr-FR')} → {new Date(req.endDate).toLocaleDateString('fr-FR')}
          </p>
          {req.comment && <p className="mt-1 text-xs italic">"{req.comment}"</p>}
        </div>
        <div className="flex gap-2">
          {(['APPROVED', 'REJECTED'] as const).map(s => (
            <button key={s} onClick={() => setStatus(s)}
              className={clsx('flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors',
                status === s ? (s === 'APPROVED' ? 'border-green-500 bg-green-50 text-green-700' : 'border-red-500 bg-red-50 text-red-600')
                  : 'border-gray-200 text-gray-600')}>
              {s === 'APPROVED' ? 'Accepter' : 'Refuser'}
            </button>
          ))}
        </div>
        <div>
          <label className="label text-xs mb-1">Commentaire (optionnel)</label>
          <textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={2} className="input-field text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={save} disabled={saving}
            className="btn-primary text-sm disabled:opacity-50">{saving ? 'Enregistrement...' : 'Valider'}</button>
        </div>
      </div>
    </div>
  );
}

export default function HrRequestsPage() {
  const { user } = useAuthStore();
  const isReviewer = ['ADMIN', 'MANAGER', 'HR'].includes(user?.role ?? '');
  const [requests, setRequests] = useState<HrRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [reviewing, setReviewing] = useState<HrRequest | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get(`/hr/requests?${params}`);
      setRequests(r.data?.data ?? []);
      setTotal(r.data?.meta?.total ?? 0);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const deleteReq = async (id: string) => {
    if (!confirm('Supprimer cette demande ?')) return;
    await api.delete(`/hr/requests/${id}`);
    load();
  };

  const FILTERS = [
    { value: '', label: 'Toutes' }, { value: 'PENDING', label: 'En attente' },
    { value: 'APPROVED', label: 'Acceptées' }, { value: 'REJECTED', label: 'Refusées' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Demandes RH</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} demande(s)</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle demande
        </button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f.label}
          </button>
        ))}
      </div>

      {showNew && <NewRequestModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {reviewing && <ReviewModal req={reviewing} onClose={() => setReviewing(null)} onSaved={() => { setReviewing(null); load(); }} />}

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : requests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune demande</div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const s = STATUS_STYLES[req.status];
            const Icon = s.icon;
            return (
              <div key={req.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold shrink-0', s.cls)}>
                      <Icon size={12} /> {s.label}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {isReviewer ? `${req.agent.firstName} ${req.agent.lastName} — ` : ''}{TYPE_LABELS[req.type]}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(req.startDate).toLocaleDateString('fr-FR')} → {new Date(req.endDate).toLocaleDateString('fr-FR')}
                      </p>
                      {req.comment && <p className="text-xs text-gray-400 italic mt-0.5">"{req.comment}"</p>}
                      {req.reviewedBy && (
                        <p className="text-xs text-gray-400 mt-1">
                          Traité par {req.reviewedBy.firstName} {req.reviewedBy.lastName}
                          {req.reviewComment && ` — "${req.reviewComment}"`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {isReviewer && req.status === 'PENDING' && (
                      <button onClick={() => setReviewing(req)} className="btn-secondary text-xs px-2 py-1">Traiter</button>
                    )}
                    {req.status === 'PENDING' && (
                      <button onClick={() => deleteReq(req.id)} className="p-1.5 hover:bg-red-50 rounded text-gray-400 hover:text-red-500">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
