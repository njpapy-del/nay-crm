'use client';

import { useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Clock, User, Building2, CheckCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/lib/api';

const DISPOSITIONS = [
  { value: 'INTERESTED',      label: 'Intéressé',       color: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { value: 'NOT_INTERESTED',  label: 'Pas intéressé',   color: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { value: 'CALLBACK',        label: 'Rappel',          color: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
  { value: 'VOICEMAIL',       label: 'Messagerie',      color: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
  { value: 'WRONG_NUMBER',    label: 'Faux numéro',     color: 'bg-gray-100 text-gray-700 hover:bg-gray-200' },
  { value: 'DNC',             label: 'Ne pas rappeler', color: 'bg-red-100 text-red-800 hover:bg-red-200' },
  { value: 'SALE',            label: '🎉 Vente !',      color: 'bg-green-200 text-green-800 hover:bg-green-300' },
] as const;

interface Lead {
  id: string; firstName: string; lastName: string;
  phone?: string; email?: string; company?: string;
}

interface Props {
  callId: string;
  lead?: Lead | null;
  callerNumber?: string;
  startedAt: Date;
  isMuted: boolean;
  onMute: (m: boolean) => void;
  onHangup: () => void;
  onDispositionSaved: () => void;
}

function useDuration(startedAt: Date) {
  const [tick, setTick] = useState(0);
  useState(() => { const t = setInterval(() => setTick((n) => n + 1), 1000); return () => clearInterval(t); });
  const s = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function CallPanel({ callId, lead, callerNumber, startedAt, isMuted, onMute, onHangup, onDispositionSaved }: Props) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const duration = useDuration(startedAt);

  const saveDisposition = async (disposition: string) => {
    setSaving(true);
    try {
      await api.patch(`/calls/${callId}/disposition`, { disposition, notes });
      onDispositionSaved();
    } finally { setSaving(false); }
  };

  const displayName = lead ? `${lead.firstName} ${lead.lastName}` : callerNumber ?? 'Inconnu';

  return (
    <div className="flex flex-col gap-4">
      {/* Identité appelant */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
        <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-lg font-bold">
          {displayName[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-lg">{displayName}</p>
          {lead?.company && (
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <Building2 size={13} /> {lead.company}
            </p>
          )}
          {lead?.email && <p className="text-xs text-gray-400">{lead.email}</p>}
        </div>
        <div className="flex items-center gap-1.5 text-green-600 font-mono text-xl font-bold">
          <Clock size={18} /> {duration}
        </div>
      </div>

      {/* Contrôles */}
      <div className="flex justify-center gap-4">
        <button onClick={() => onMute(!isMuted)}
          className={clsx('w-12 h-12 rounded-full flex items-center justify-center transition-colors',
            isMuted ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300')}>
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        </button>
        <button onClick={onHangup}
          className="w-14 h-14 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-lg">
          <PhoneOff size={22} />
        </button>
      </div>

      {/* Notes rapides */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes sur l'appel..."
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none focus:ring-2 focus:ring-primary-300"
        rows={2}
      />

      {/* Dispositions */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Qualification</p>
        <div className="grid grid-cols-2 gap-1.5">
          {DISPOSITIONS.map((d) => (
            <button key={d.value} onClick={() => saveDisposition(d.value)} disabled={saving}
              className={clsx('px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left', d.color)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Panneau wrap-up post-appel */
export function WrapUpPanel({ callId, onDone }: { callId: string; onDone: () => void }) {
  const [notes, setNotes] = useState('');
  const [disposition, setDisposition] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      if (disposition) await api.patch(`/calls/${callId}/disposition`, { disposition, notes });
      onDone();
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
      <p className="font-semibold text-yellow-800 text-sm">Wrap-up — Qualifiez l'appel</p>
      <div className="grid grid-cols-2 gap-1.5">
        {DISPOSITIONS.map((d) => (
          <button key={d.value} onClick={() => setDisposition(d.value)}
            className={clsx('px-3 py-2 rounded-lg text-xs font-medium transition-all border-2',
              disposition === d.value ? 'border-primary-500 ' + d.color : 'border-transparent ' + d.color)}>
            {d.label}
          </button>
        ))}
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes..." rows={2}
        className="w-full border border-yellow-300 rounded-lg px-3 py-2 text-sm resize-none outline-none bg-white" />
      <button onClick={save} disabled={saving}
        className="w-full btn-primary flex items-center justify-center gap-2">
        <CheckCircle size={16} /> {saving ? 'Enregistrement...' : 'Terminer & Disponible'}
      </button>
    </div>
  );
}
