'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  X, Phone, Calendar, Clock, CheckCircle2, Loader2,
  ChevronRight, MessageSquare, User, Briefcase, UserPlus,
} from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';
import { ScriptPlayer } from '@/components/scripts/ScriptPlayer';

// ─── Types ────────────────────────────────────────────────────────────────────

type Qualification =
  | 'SALE' | 'APPOINTMENT' | 'NOT_INTERESTED' | 'CALLBACK'
  | 'WRONG_NUMBER' | 'VOICEMAIL' | 'DNC' | 'NRP'
  | 'UNREACHABLE' | 'REFUSAL' | 'OUT_OF_TARGET' | 'OTHER';

interface QualifMeta { label: string; color: string; bg: string; icon: string; needsDate?: boolean; dateField?: 'rdvAt' | 'callbackAt' }

const QUALIFICATIONS: Record<Qualification, QualifMeta> = {
  SALE:           { label: 'Vente',           color: '#15803d', bg: '#f0fdf4', icon: '💰' },
  APPOINTMENT:    { label: 'RDV',             color: '#1d4ed8', bg: '#eff6ff', icon: '📅', needsDate: true, dateField: 'rdvAt' },
  CALLBACK:       { label: 'Rappel',          color: '#d97706', bg: '#fffbeb', icon: '🔁', needsDate: true, dateField: 'callbackAt' },
  NOT_INTERESTED: { label: 'Pas intéressé',   color: '#6b7280', bg: '#f9fafb', icon: '🚫' },
  REFUSAL:        { label: 'Refus',           color: '#b91c1c', bg: '#fef2f2', icon: '✋' },
  NRP:            { label: 'NRP',             color: '#ef4444', bg: '#fef2f2', icon: '📞' },
  UNREACHABLE:    { label: 'Injoignable',     color: '#f97316', bg: '#fff7ed', icon: '📵' },
  VOICEMAIL:      { label: 'Répondeur',       color: '#7c3aed', bg: '#f5f3ff', icon: '📬' },
  WRONG_NUMBER:   { label: 'Faux numéro',     color: '#9ca3af', bg: '#f9fafb', icon: '🔇' },
  OUT_OF_TARGET:  { label: 'Hors cible (HC)', color: '#b45309', bg: '#fffbeb', icon: '🎯' },
  DNC:            { label: 'DNC',             color: '#dc2626', bg: '#fef2f2', icon: '⛔' },
  OTHER:          { label: 'Autre',           color: '#64748b', bg: '#f8fafc', icon: '📝' },
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  callId: string;
  callLogId?: string;
  onClose: () => void;
  onNextCall?: () => void;
  /** Mode obligatoire : empêche la fermeture sans qualification */
  mandatory?: boolean;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function PostCallModal({ callId, callLogId, onClose, onNextCall, mandatory = false }: Props) {
  const [context, setContext] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Qualification | null>(null);
  const [rdvAt, setRdvAt] = useState('');
  const [callbackAt, setCallbackAt] = useState('');
  const [notes, setNotes] = useState('');
  const [motifRefus, setMotifRefus] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'qualif' | 'script'>('qualif');
  const [elapsed, setElapsed] = useState(0);

  // Fiche client (pour qualification RDV)
  const [clientForm, setClientForm] = useState({
    firstName: '', lastName: '', phone: '', email: '',
    company: '', address: '', postalCode: '', clientNotes: '',
  });

  // Wrap-up timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Load call context
  useEffect(() => {
    if (!callId) { setLoading(false); return; }
    api.get(`/qualifications/context/${callId}`)
      .then(r => {
        const ctx = r.data?.data ?? r.data;
        setContext(ctx);
        // Pré-remplir fiche client depuis le contact de l'appel
        const c = ctx?.callLog?.call?.client ?? ctx?.callLog?.call?.lead ?? null;
        if (c) {
          setClientForm(prev => ({
            ...prev,
            firstName:   c.firstName ?? '',
            lastName:    c.lastName  ?? '',
            phone:       c.phone     ?? '',
            email:       c.email     ?? '',
            company:     c.company   ?? '',
            address:     c.address   ?? '',
            postalCode:  c.postalCode ?? '',
          }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [callId]);

  const meta = selected ? QUALIFICATIONS[selected] : null;
  const needsMotif = selected === 'REFUSAL' || selected === 'NRP';

  const canSave = selected !== null
    && (meta?.needsDate ? (meta.dateField === 'rdvAt' ? !!rdvAt : !!callbackAt) : true)
    && (needsMotif ? !!motifRefus.trim() : true);

  const save = useCallback(async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    try {
      const log = context?.callLog;
      const payload: any = {
        callId,
        callLogId: callLogId ?? log?.id,
        qualification: selected,
        agentNotes: notes || undefined,
        rdvAt: rdvAt || undefined,
        callbackAt: callbackAt || undefined,
        motifRefus: motifRefus || undefined,
        postCallDurationSec: elapsed,
        campaignId: log?.campaignId,
      };
      // Inclure la fiche client si qualification RDV
      if (selected === 'APPOINTMENT') {
        payload.clientFirstName  = clientForm.firstName  || undefined;
        payload.clientLastName   = clientForm.lastName   || undefined;
        payload.clientPhone      = clientForm.phone      || undefined;
        payload.clientEmail      = clientForm.email      || undefined;
        payload.clientCompany    = clientForm.company    || undefined;
        payload.clientAddress    = clientForm.address    || undefined;
        payload.clientPostalCode = clientForm.postalCode || undefined;
        payload.clientNotes      = clientForm.clientNotes || undefined;
      }
      await api.post('/qualifications', payload);
      setSaved(true);
    } finally { setSaving(false); }
  }, [selected, canSave, callId, callLogId, context, notes, rdvAt, callbackAt, motifRefus, elapsed]);

  const fmtElapsed = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const client = context?.callLog?.call?.client;
  const lead = context?.callLog?.call?.lead;
  const contact = client ?? lead;
  const campaign = context?.callLog?.campaign;
  const scriptId = context?.script?.id;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — cliquable seulement si non obligatoire */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={mandatory ? undefined : onClose}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-700 to-primary-600 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <Phone size={18} />
            </div>
            <div>
              <p className="font-bold text-lg leading-tight">
                {contact ? `${contact.firstName} ${contact.lastName}` : context?.callLog?.calleeNumber ?? 'Appel terminé'}
              </p>
              <p className="text-white/70 text-xs">
                {campaign?.name ?? 'Sans campagne'} · Durée wrap-up : {fmtElapsed(elapsed)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mandatory && !saved && (
              <span className="text-xs bg-red-500/80 text-white px-2.5 py-1 rounded-full font-medium">
                Qualification obligatoire
              </span>
            )}
            {saved && (
              <span className="flex items-center gap-1 text-xs bg-green-500 text-white px-2.5 py-1 rounded-full font-medium">
                <CheckCircle2 size={12} /> Qualifié
              </span>
            )}
            {!mandatory && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors">
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Contact info bar */}
        {contact && (
          <div className="flex items-center gap-4 px-6 py-2.5 bg-gray-50 border-b border-gray-100 text-sm shrink-0">
            <div className="flex items-center gap-1.5 text-gray-600">
              <User size={13} className="text-gray-400" />
              {contact.firstName} {contact.lastName}
              {contact.company && <span className="text-gray-400">— {contact.company}</span>}
            </div>
            {contact.phone && (
              <span className="font-mono text-xs text-gray-500">{contact.phone}</span>
            )}
            {campaign && (
              <div className="flex items-center gap-1.5 text-gray-500 ml-auto">
                <Briefcase size={12} /> {campaign.name}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-100 px-6 shrink-0">
          {[
            { id: 'qualif', label: 'Qualification' },
            ...(scriptId ? [{ id: 'script', label: 'Script' }] : []),
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={clsx(
                'py-3 px-1 mr-6 text-sm font-medium border-b-2 transition-colors',
                tab === t.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700',
              )}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-gray-400" />
            </div>
          ) : tab === 'qualif' ? (
            <div className="space-y-5">

              {/* Qualification grid */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Résultat de l'appel *</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {(Object.entries(QUALIFICATIONS) as [Qualification, QualifMeta][]).map(([key, q]) => (
                    <button key={key} onClick={() => setSelected(key)}
                      className={clsx(
                        'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all',
                        selected === key
                          ? 'border-current scale-105 shadow-md'
                          : 'border-gray-200 hover:border-gray-300 hover:shadow-sm bg-white',
                      )}
                      style={selected === key ? { borderColor: q.color, background: q.bg, color: q.color } : {}}>
                      <span className="text-xl leading-none">{q.icon}</span>
                      <span className="text-center leading-tight">{q.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Date picker + fiche client pour RDV */}
              {selected === 'APPOINTMENT' && (
                <>
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-blue-800 mb-2">
                      <Calendar size={15} /> Date et heure du RDV *
                    </label>
                    <input type="datetime-local" className="input w-full"
                      value={rdvAt} onChange={e => setRdvAt(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)} />
                  </div>

                  {/* Fiche client */}
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold">
                      <UserPlus size={15} /> Fiche client — créée automatiquement à la validation
                    </div>
                    <div className="p-4 space-y-3 bg-blue-50/40">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Prénom</label>
                          <input className="input w-full text-sm" value={clientForm.firstName}
                            onChange={e => setClientForm(p => ({ ...p, firstName: e.target.value }))}
                            placeholder="Prénom" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Nom</label>
                          <input className="input w-full text-sm" value={clientForm.lastName}
                            onChange={e => setClientForm(p => ({ ...p, lastName: e.target.value }))}
                            placeholder="Nom" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Téléphone</label>
                          <input className="input w-full text-sm" value={clientForm.phone}
                            onChange={e => setClientForm(p => ({ ...p, phone: e.target.value }))}
                            placeholder="+33..." />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                          <input className="input w-full text-sm" type="email" value={clientForm.email}
                            onChange={e => setClientForm(p => ({ ...p, email: e.target.value }))}
                            placeholder="email@..." />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Adresse</label>
                          <input className="input w-full text-sm" value={clientForm.address}
                            onChange={e => setClientForm(p => ({ ...p, address: e.target.value }))}
                            placeholder="12 rue de la Paix" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 mb-1 block">Code postal</label>
                          <input className="input w-full text-sm" value={clientForm.postalCode}
                            onChange={e => setClientForm(p => ({ ...p, postalCode: e.target.value }))}
                            placeholder="75001" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">Commentaires</label>
                        <textarea className="input w-full text-sm resize-none" rows={2}
                          value={clientForm.clientNotes}
                          onChange={e => setClientForm(p => ({ ...p, clientNotes: e.target.value }))}
                          placeholder="Notes sur le client..." />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Date picker for Rappel */}
              {selected === 'CALLBACK' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-2">
                    <Clock size={15} /> Date et heure de rappel *
                  </label>
                  <input type="datetime-local" className="input w-full"
                    value={callbackAt} onChange={e => setCallbackAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)} />
                </div>
              )}

              {/* Motif refus */}
              {needsMotif && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-red-800 mb-2">
                    <MessageSquare size={15} /> Motif du refus *
                  </label>
                  <input
                    className="input w-full text-sm"
                    value={motifRefus}
                    onChange={e => setMotifRefus(e.target.value)}
                    placeholder="Ex: Pas le bon interlocuteur, déjà équipé…"
                  />
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <MessageSquare size={13} /> Commentaire agent
                </label>
                <textarea className="input w-full resize-none text-sm" rows={3}
                  value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notes sur l'appel, besoins du contact…" />
              </div>
            </div>
          ) : (
            /* Script tab */
            scriptId && (
              <ScriptPlayer
                scriptId={scriptId}
                callId={callId}
                campaignId={context?.callLog?.campaignId}
              />
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          {!mandatory && (
            <button onClick={onClose} className="btn-secondary text-sm">
              Fermer
            </button>
          )}
          {mandatory && !saved && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              ⚠️ Qualification requise avant le prochain appel
            </p>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {!saved ? (
              <button onClick={save} disabled={!canSave || saving}
                className={clsx(
                  'flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all',
                  canSave
                    ? 'bg-primary-600 hover:bg-primary-700 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                )}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                {mandatory ? 'Valider & passer au suivant' : 'Valider la qualification'}
              </button>
            ) : onNextCall ? (
              <button onClick={onNextCall}
                className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm bg-green-600 hover:bg-green-700 text-white transition-colors">
                Prochain appel <ChevronRight size={15} />
              </button>
            ) : (
              <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
                <CheckCircle2 size={16} /> Qualifié avec succès
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
