'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CheckCircle, XCircle, AlertCircle, Filter, Plus } from 'lucide-react';
import { clsx } from 'clsx';

type QualifStatus = 'OK' | 'KO' | 'HCC' | 'HC';

interface Qualification {
  id: string; status: QualifStatus; qualityScore?: number; comment?: string; createdAt: string;
  qualifiedBy: { firstName: string; lastName: string };
  appointment: { id: string; title: string; startAt: string; agent: { firstName: string; lastName: string } };
}

const STATUS_STYLES: Record<QualifStatus, { label: string; cls: string; icon: any }> = {
  OK:  { label: 'OK',  cls: 'bg-green-100 text-green-700',  icon: CheckCircle },
  KO:  { label: 'KO',  cls: 'bg-red-100 text-red-600',      icon: XCircle },
  HCC: { label: 'HCC', cls: 'bg-orange-100 text-orange-700', icon: AlertCircle },
  HC:  { label: 'HC',  cls: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
};

const FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes' }, { value: 'OK', label: 'OK' },
  { value: 'KO', label: 'KO' }, { value: 'HCC', label: 'HCC' }, { value: 'HC', label: 'HC' },
];

function QualifyModal({ appointmentId, onClose, onSaved }: { appointmentId: string; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<QualifStatus>('OK');
  const [qualityScore, setQualityScore] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.post(`/quality/appointments/${appointmentId}/qualify`, { status, qualityScore, comment });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Qualifier un RDV</h2>
        <div>
          <label className="label text-xs mb-2">Statut</label>
          <div className="flex gap-2">
            {(['OK','KO','HCC','HC'] as QualifStatus[]).map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={clsx('flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors',
                  status === s ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600')}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label text-xs mb-1">Score qualité (0–100)</label>
          <input type="number" min={0} max={100} value={qualityScore}
            onChange={e => setQualityScore(+e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="label text-xs mb-1">Commentaire</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="input-field text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={save} disabled={saving}
            className="btn-primary text-sm disabled:opacity-50">{saving ? 'Enregistrement...' : 'Qualifier'}</button>
        </div>
      </div>
    </div>
  );
}

export default function QualificationsPage() {
  const [qualifs, setQualifs] = useState<Qualification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '30' });
      if (statusFilter) params.set('status', statusFilter);
      const r = await api.get(`/quality/qualifications?${params}`);
      setQualifs(r.data?.data ?? []);
      setTotal(r.data?.meta?.total ?? 0);
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Qualifications RDV</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} qualification(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button key={f.value} onClick={() => setStatusFilter(f.value)}
            className={clsx('px-3 py-1 rounded-full text-xs font-medium transition-colors',
              statusFilter === f.value ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {f.label}
          </button>
        ))}
      </div>

      {showModal && (
        <QualifyModal appointmentId={showModal} onClose={() => setShowModal(null)} onSaved={() => { setShowModal(null); load(); }} />
      )}

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : qualifs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune qualification</div>
      ) : (
        <div className="space-y-2">
          {qualifs.map(q => {
            const s = STATUS_STYLES[q.status];
            const Icon = s.icon;
            return (
              <div key={q.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={clsx('flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold', s.cls)}>
                    <Icon size={12} /> {s.label}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{q.appointment.title}</p>
                    <p className="text-xs text-gray-400">
                      Agent : {q.appointment.agent.firstName} {q.appointment.agent.lastName} ·
                      {new Date(q.appointment.startAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {q.qualityScore != null && (
                    <p className="text-sm font-bold text-gray-900">{q.qualityScore}/100</p>
                  )}
                  <p className="text-xs text-gray-400">par {q.qualifiedBy.firstName} {q.qualifiedBy.lastName}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
