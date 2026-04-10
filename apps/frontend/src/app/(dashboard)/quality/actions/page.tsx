'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Plus, X, GraduationCap, MessageSquare, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';

type ActionType = 'FORMATION' | 'DEBRIEF' | 'RECADRAGE';

interface QualityAction {
  id: string; type: ActionType; comment: string; createdAt: string;
  agent: { firstName: string; lastName: string };
  createdBy: { firstName: string; lastName: string };
}

const ACTION_STYLES: Record<ActionType, { label: string; cls: string; icon: any }> = {
  FORMATION: { label: 'Formation',  cls: 'bg-blue-100 text-blue-700',   icon: GraduationCap },
  DEBRIEF:   { label: 'Débrief',    cls: 'bg-purple-100 text-purple-700', icon: MessageSquare },
  RECADRAGE: { label: 'Recadrage',  cls: 'bg-red-100 text-red-600',      icon: AlertTriangle },
};

function NewActionModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<ActionType>('DEBRIEF');
  const [agentId, setAgentId] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!agentId || !comment.trim()) return;
    setSaving(true);
    try {
      await api.post('/quality/actions', { type, agentId, comment });
      onSaved();
    } catch (e: any) { alert(e?.response?.data?.message ?? 'Erreur'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Nouvelle action corrective</h2>
          <button onClick={onClose}><X size={16} /></button>
        </div>
        <div>
          <label className="label text-xs mb-2">Type</label>
          <div className="flex gap-2">
            {(Object.keys(ACTION_STYLES) as ActionType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={clsx('flex-1 py-2 rounded-lg text-xs font-bold border-2 transition-colors',
                  type === t ? 'border-primary-600 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600')}>
                {ACTION_STYLES[t].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label text-xs mb-1">ID de l'agent</label>
          <input value={agentId} onChange={e => setAgentId(e.target.value)} className="input-field text-sm" placeholder="agentId" />
        </div>
        <div>
          <label className="label text-xs mb-1">Commentaire / décision</label>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} className="input-field text-sm" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary text-sm">Annuler</button>
          <button onClick={save} disabled={saving || !agentId || !comment.trim()}
            className="btn-primary text-sm disabled:opacity-50">{saving ? 'Enregistrement...' : 'Créer'}</button>
        </div>
      </div>
    </div>
  );
}

export default function QualityActionsPage() {
  const [actions, setActions] = useState<QualityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/quality/actions');
      setActions(r.data?.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Actions correctives</h1>
          <p className="text-sm text-gray-500 mt-0.5">{actions.length} action(s)</p>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouvelle action
        </button>
      </div>

      {showNew && <NewActionModal onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}

      {loading ? <div className="text-center py-12 text-gray-400">Chargement...</div> : actions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Aucune action</div>
      ) : (
        <div className="space-y-3">
          {actions.map(a => {
            const s = ACTION_STYLES[a.type];
            const Icon = s.icon;
            return (
              <div key={a.id} className="card p-4 flex items-start gap-4">
                <div className={clsx('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', s.cls.replace('text-', 'bg-').replace('100', '200'))}>
                  <Icon size={16} className={s.cls.split(' ')[1]} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={clsx('px-2 py-0.5 rounded-full text-xs font-bold', s.cls)}>{s.label}</span>
                    <span className="text-sm font-medium text-gray-900">{a.agent.firstName} {a.agent.lastName}</span>
                  </div>
                  <p className="text-sm text-gray-600">{a.comment}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Par {a.createdBy.firstName} {a.createdBy.lastName} · {new Date(a.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
