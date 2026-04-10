'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Phone, Pause, Play, LogOut, Wifi, WifiOff, PhoneCall, X, Search,
  User, FileText, Bell, History, CheckCircle2, Loader2,
  PhoneMissed, PhoneForwarded, PhoneOff, Delete,
} from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useAgentStore } from '@/stores/agent.store';
import { useCallMonitor } from '@/hooks/use-call-monitor';
import { CallPanel, WrapUpPanel } from '@/components/telephony/call-panel';
import { Softphone } from '@/components/telephony/softphone';
import { PostCallModal } from '@/components/calls/PostCallModal';
import { usePostCall } from '@/hooks/usePostCall';
import { ScriptPlayer } from '@/components/scripts/ScriptPlayer';
import { PauseOverlay } from '@/components/agent-status/PauseOverlay';
import { AgentManagerChat } from '@/components/agent/AgentManagerChat';
import { clsx } from 'clsx';
import { api } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Campaign { id: string; name: string; status: string; }
interface Lead {
  id: string; firstName: string; lastName: string; phone: string; phone2?: string;
  email?: string; address?: string; city?: string; postalCode?: string;
  company?: string; notes?: string; campaignId?: string;
}
interface CallbackLead extends Lead { company?: string; }
interface Qualification { id: string; label: string; code: string; color: string; isPositive: boolean; }
interface CallLog {
  id: string; qualification: string | null; durationSec: number | null;
  createdAt: string; callerNumber: string;
  call: { direction: string } | null;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const AVAIL_COLORS: Record<string, string> = {
  OFFLINE: 'bg-gray-400', AVAILABLE: 'bg-green-400',
  RINGING: 'bg-blue-400 animate-pulse', IN_CALL: 'bg-green-500',
  WRAP_UP: 'bg-yellow-400', PAUSED: 'bg-orange-400',
};
const AVAIL_LABELS: Record<string, string> = {
  OFFLINE: 'Hors ligne', AVAILABLE: 'Disponible', RINGING: 'Sonnerie...',
  IN_CALL: 'En appel', WRAP_UP: 'Wrap-up', PAUSED: 'En pause',
};

const PAUSE_REASONS = [
  { key: 'DEBRIEF',       label: 'Débrief',            icon: '📋' },
  { key: 'COFFEE_BREAK',  label: 'Pause café',         icon: '☕' },
  { key: 'LUNCH_BREAK',   label: 'Pause déjeuner',     icon: '🍽️' },
  { key: 'TRAINING',      label: 'Formation',          icon: '📚' },
  { key: 'TECH_ISSUE',    label: 'Problème technique', icon: '🔧' },
];

const DEFAULT_QUALIFS: Qualification[] = [
  { id: 'RDV',          label: 'RDV',           code: 'APPOINTMENT',   color: '#3b82f6', isPositive: true },
  { id: 'SALE',         label: 'Vente',          code: 'SALE',          color: '#10b981', isPositive: true },
  { id: 'CALLBACK',     label: 'À rappeler',     code: 'CALLBACK',      color: '#f59e0b', isPositive: false },
  { id: 'VOICEMAIL',    label: 'Répondeur',      code: 'VOICEMAIL',     color: '#6b7280', isPositive: false },
  { id: 'NO_ANSWER',    label: 'Pas de réponse', code: 'NO_ANSWER',     color: '#f97316', isPositive: false },
  { id: 'NOT_INTERESTED', label: 'Pas intéressé', code: 'NOT_INTERESTED', color: '#ef4444', isPositive: false },
  { id: 'HC',           label: 'Hors cible',     code: 'HC',            color: '#8b5cf6', isPositive: false },
  { id: 'OTHER',        label: 'Autre',          code: 'OTHER',         color: '#9ca3af', isPositive: false },
];

const fmt = (s?: number | null) => {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function ClientFiche({ lead }: { lead: Lead | null }) {
  const [agentNotes, setAgentNotes] = useState('');

  // Champs toujours affichés, remplis ou non
  const infoFields = [
    { label: 'Nom',                val: lead?.lastName,    mono: false },
    { label: 'Prénom',             val: lead?.firstName,   mono: false },
    { label: 'Tél. portable',      val: lead?.phone,       mono: true  },
    { label: 'Tél. fixe',          val: lead?.phone2,      mono: true  },
    { label: 'Email',              val: lead?.email,       mono: false },
    { label: 'Adresse',            val: lead?.address,     mono: false },
    { label: 'Code postal',        val: lead?.postalCode,  mono: false },
  ];

  return (
    <div className="space-y-3">
      {/* Avatar + nom */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
        <div className={clsx(
          'w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0',
          lead ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-300',
        )}>
          {lead ? `${lead.firstName?.[0] ?? ''}${lead.lastName?.[0] ?? ''}` : <User size={24} />}
        </div>
        <div>
          <p className="text-base font-bold text-gray-900">
            {lead ? `${lead.firstName} ${lead.lastName}` : '— Aucun contact —'}
          </p>
          {lead?.company && <p className="text-sm text-gray-500">{lead.company}</p>}
        </div>
      </div>

      {/* Grille champs */}
      <div className="divide-y divide-gray-50">
        {infoFields.map((f) => (
          <div key={f.label} className="flex items-center gap-3 py-2.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide w-28 shrink-0">{f.label}</span>
            {f.val ? (
              <span className={clsx(
                'font-medium break-all',
                f.mono ? 'font-mono text-primary-700 text-base' : 'text-sm text-gray-800',
              )}>{f.val}</span>
            ) : (
              <span className="text-sm text-gray-300 italic">—</span>
            )}
          </div>
        ))}
      </div>

      {/* Commentaires agent — toujours visible et éditable */}
      <div className="pt-1">
        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
          Commentaires
        </label>
        <textarea
          value={agentNotes}
          onChange={(e) => setAgentNotes(e.target.value)}
          rows={4}
          placeholder="Notez vos remarques sur la conversation avant de qualifier…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition placeholder:text-gray-300"
        />
      </div>
    </div>
  );
}

function QuickQualification({
  callLogId, campaignId, onSaved,
}: { callLogId: string | null; campaignId?: string; onSaved: () => void }) {
  const [qualifs,  setQualifs]  = useState<Qualification[]>(DEFAULT_QUALIFS);
  const [saving,   setSaving]   = useState<string | null>(null);
  const [saved,    setSaved]    = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) return;
    api.get(`/campaigns/${campaignId}/qualifications`).then((r) => {
      const list: Qualification[] = r.data?.data ?? r.data ?? [];
      if (list.length > 0) setQualifs(list);
    }).catch(() => {});
  }, [campaignId]);

  const qualify = async (code: string, qualifId: string) => {
    if (!callLogId) return;
    setSaving(qualifId);
    try {
      await api.patch(`/call-logs/${callLogId}`, { qualification: code });
      setSaved(qualifId);
      setTimeout(() => { setSaved(null); onSaved(); }, 1200);
    } finally { setSaving(null); }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase">Qualification rapide</p>
      <div className="grid grid-cols-2 gap-1.5">
        {qualifs.map((q) => (
          <button
            key={q.id}
            onClick={() => qualify(q.code, q.id)}
            disabled={!callLogId || saving === q.id || saved !== null}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left',
              saved === q.id
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 disabled:opacity-40',
            )}>
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: q.color }}
            />
            {saving === q.id ? <Loader2 size={11} className="animate-spin" /> : null}
            {saved === q.id ? <CheckCircle2 size={11} className="text-green-600" /> : null}
            {q.label}
          </button>
        ))}
      </div>
      {!callLogId && (
        <p className="text-xs text-gray-400 text-center pt-1">Disponible pendant / après un appel</p>
      )}
    </div>
  );
}

function ManualCallPanel({ extension, campaignId, onClose }: { extension: string; campaignId?: string; onClose: () => void }) {
  const [search,     setSearch]     = useState('');
  const [leads,      setLeads]      = useState<CallbackLead[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [calling,    setCalling]    = useState<string | null>(null);
  const [manualNum,  setManualNum]  = useState('');
  const [callingNum, setCallingNum] = useState(false);

  const searchLeads = useCallback(async (q: string) => {
    if (q.length < 2) { setLeads([]); return; }
    setLoading(true);
    try {
      const params = new URLSearchParams({ search: q, limit: '20' });
      if (campaignId) params.set('campaignId', campaignId);
      const res = await api.get(`/leads?${params}`);
      setLeads(res.data?.data?.data ?? res.data?.data ?? res.data ?? []);
    } catch {} finally { setLoading(false); }
  }, [campaignId]);

  useEffect(() => {
    const t = setTimeout(() => searchLeads(search), 300);
    return () => clearTimeout(t);
  }, [search, searchLeads]);

  const originate = async (destination: string, leadId?: string) => {
    setCalling(leadId ?? destination);
    try {
      await api.post('/calls/originate', { destination, agentExtension: extension, leadId });
    } catch (e: any) {
      alert(`Erreur : ${e?.response?.data?.message ?? 'Impossible d\'initier l\'appel'}`);
    } finally { setCalling(null); }
  };

  const callManual = async () => {
    if (!manualNum.trim()) return;
    setCallingNum(true);
    try {
      await api.post('/calls/originate', { destination: manualNum.trim(), agentExtension: extension });
      setManualNum('');
    } catch (e: any) {
      alert(`Erreur : ${e?.response?.data?.message ?? 'Impossible d\'initier l\'appel'}`);
    } finally { setCallingNum(false); }
  };

  return (
    <div className="card border-2 border-primary-200 bg-primary-50/30">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-primary-100">
        <div className="flex items-center gap-2">
          <PhoneCall size={16} className="text-primary-600" />
          <h3 className="font-semibold text-gray-900 text-sm">Appel manuel / Rappel</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
      </div>
      <div className="p-4 space-y-4">
        {/* ── Clavier numérique ── */}
        <div className="space-y-3">
          {/* Écran affichage */}
          <div className="bg-gray-900 rounded-2xl px-5 py-4 text-center min-h-[64px] flex items-center justify-center relative">
            <span className="font-mono text-2xl font-bold text-white tracking-widest">
              {manualNum || <span className="text-gray-500 text-lg font-normal">Composez un numéro</span>}
            </span>
            {manualNum && (
              <button onClick={() => setManualNum(v => v.slice(0, -1))}
                className="absolute right-4 text-gray-400 hover:text-white transition-colors">
                <Delete size={20} />
              </button>
            )}
          </div>
          {/* Grille touches 3×4 */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { d: '1', s: '' }, { d: '2', s: 'ABC' }, { d: '3', s: 'DEF' },
              { d: '4', s: 'GHI' }, { d: '5', s: 'JKL' }, { d: '6', s: 'MNO' },
              { d: '7', s: 'PQRS' }, { d: '8', s: 'TUV' }, { d: '9', s: 'WXYZ' },
              { d: '*', s: '' }, { d: '0', s: '+' }, { d: '#', s: '' },
            ].map(({ d, s }) => (
              <button key={d} onClick={() => setManualNum(v => v + d)}
                className="flex flex-col items-center justify-center py-4 rounded-2xl bg-gray-50 hover:bg-gray-100 active:scale-95 border border-gray-200 transition-all select-none">
                <span className="text-xl font-bold text-gray-800 leading-none">{d}</span>
                {s && <span className="text-[10px] text-gray-400 font-medium mt-0.5 tracking-wider">{s}</span>}
              </button>
            ))}
          </div>
          {/* Bouton appel */}
          <button onClick={callManual} disabled={!manualNum.trim() || callingNum}
            className="w-full py-4 rounded-2xl bg-green-500 hover:bg-green-600 active:scale-[.98] text-white font-bold text-lg flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-green-200">
            <Phone size={22} fill="white" />
            {callingNum ? 'Appel en cours…' : 'Appeler'}
          </button>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <div className="flex-1 h-px bg-gray-200" />ou rechercher un lead<div className="flex-1 h-px bg-gray-200" />
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Nom, prénom, téléphone…" className="input-field pl-8 text-sm" />
        </div>
        {loading && <p className="text-xs text-gray-400 text-center py-2">Recherche…</p>}
        {!loading && leads.length > 0 && (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between bg-white rounded-lg border border-gray-100 px-3 py-2.5 hover:border-primary-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{lead.firstName} {lead.lastName}</p>
                  <p className="text-xs text-gray-500 font-mono">{lead.phone}</p>
                  {lead.company && <p className="text-xs text-gray-400">{lead.company}</p>}
                </div>
                <button onClick={() => originate(lead.phone, lead.id)} disabled={calling === lead.id}
                  className="flex items-center gap-1.5 text-xs btn-primary px-3 py-1.5 disabled:opacity-50">
                  <Phone size={12} /> {calling === lead.id ? 'Appel…' : 'Rappeler'}
                </button>
              </div>
            ))}
          </div>
        )}
        {!loading && search.length >= 2 && leads.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">Aucun lead trouvé</p>
        )}
      </div>
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

type SideTab = 'script' | 'rappels' | 'historique';

export default function AgentPage() {
  const { user } = useAuthStore();

  // État persisté (survit à la navigation)
  const {
    logged, extension, selectedCamp, campDialerMode, sipConfig,
    setLogged, setExtension, setSelectedCamp, setCampDialerMode, setSipConfig, reset: resetAgentStore,
  } = useAgentStore();

  // État local (volatile, remis à zéro si page rechargée)
  const [isMuted,       setIsMuted]       = useState(false);
  const [postCallData,  setPostCallData]  = useState<{ callId: string; callLogId?: string } | null>(null);
  const [pauseReason,   setPauseReason]   = useState<string>('');
  const [resumeLoading, setResumeLoading] = useState(false);
  const [campaigns,    setCampaigns]    = useState<Campaign[]>([]);
  const [showManual,   setShowManual]   = useState(false);
  const [sideTab,      setSideTab]      = useState<SideTab>('script');
  const [currentLead,  setCurrentLead]  = useState<Lead | null>(null);
  const [callLogId,    setCallLogId]    = useState<string | null>(null);
  const [recentLogs,   setRecentLogs]   = useState<CallLog[]>([]);
  const [scripts,      setScripts]      = useState<{ id: string; title: string }[]>([]);
  const [activeScript, setActiveScript] = useState<{ id: string; title: string } | null>(null);
  const [callbacks,    setCallbacks]    = useState<Lead[]>([]);

  const { triggerPostCall } = usePostCall((payload) => setPostCallData(payload));

  const {
    connected, agentState, incomingCall, activeCall, wrapUp,
    chatMessages, chatUnread,
    pause, resume, endWrapUp, hangup, replyToManager, clearChatUnread,
  } = useCallMonitor({
    tenantId: user?.tenantId ?? '',
    agentId: logged ? user?.id : undefined,
    extension: logged ? extension : undefined,
    role: (user?.role ?? 'AGENT') as 'ADMIN' | 'MANAGER' | 'AGENT',
  });

  // Charger campagnes
  useEffect(() => {
    api.get('/campaigns?status=ACTIVE&limit=50').then(r => {
      const data = r.data?.data ?? r.data;
      setCampaigns(Array.isArray(data) ? data : data?.data ?? []);
    }).catch(() => {});
  }, [logged]);

  // Charger lead courant depuis appel entrant
  useEffect(() => {
    if (incomingCall?.lead) {
      setCurrentLead({
        id: incomingCall.lead.id ?? '',
        firstName: incomingCall.lead.firstName ?? '',
        lastName: incomingCall.lead.lastName ?? '',
        phone: incomingCall.lead.phone ?? incomingCall.callerNumber ?? '',
      });
      setSideTab('script');
    }
  }, [incomingCall]);

  // Charger mode dialer quand campagne change
  useEffect(() => {
    if (!selectedCamp) { setCampDialerMode(null); return; }
    api.get(`/campaigns/${selectedCamp}`).then(r => {
      const camp = r.data?.data ?? r.data;
      setCampDialerMode(camp?.settings?.dialerMode ?? null);
    }).catch(() => {});
  }, [selectedCamp]);

  // Charger scripts quand campagne change
  useEffect(() => {
    if (!selectedCamp) { setScripts([]); return; }
    api.get(`/scripts?campaignId=${selectedCamp}`).then(r => {
      const list = r.data?.data ?? r.data ?? [];
      setScripts(list);
    }).catch(() => {});
  }, [selectedCamp]);

  // Charger rappels
  const fetchCallbacks = useCallback(async () => {
    if (!logged) return;
    try {
      const res = await api.get(`/call-logs?qualification=CALLBACK&limit=10${selectedCamp ? `&campaignId=${selectedCamp}` : ''}`);
      setCallbacks((res.data?.data ?? []).map((l: any) => ({
        id: l.call?.lead?.id ?? l.id,
        firstName: l.call?.lead?.firstName ?? '?',
        lastName: l.call?.lead?.lastName ?? '',
        phone: l.calleeNumber ?? '',
      })));
    } catch {}
  }, [logged, selectedCamp]);

  // Charger historique agent
  const fetchHistory = useCallback(async () => {
    if (!logged) return;
    try {
      const res = await api.get('/call-logs?limit=10');
      setRecentLogs(res.data?.data ?? []);
    } catch {}
  }, [logged]);

  useEffect(() => {
    if (sideTab === 'rappels')   fetchCallbacks();
    if (sideTab === 'historique') fetchHistory();
  }, [sideTab, fetchCallbacks, fetchHistory]);

  const handleLogin = async () => {
    if (!extension.trim()) return;
    await api.post('/calls/agent/login', { extension, campaignId: selectedCamp || undefined });
    setSipConfig({
      wsUri: `wss://${window.location.hostname}:8089/ws`,
      sipUri: `sip:${extension}@${window.location.hostname}`,
      password: `Ag${extension}!Secure`,
      displayName: `${user?.firstName} ${user?.lastName}`,
    });
    setLogged(true);
  };

  const handleLogout = async () => {
    await api.post('/calls/agent/logout');
    resetAgentStore();
    setShowManual(false);
    setCurrentLead(null);
  };

  const handlePause = async (reason: string) => {
    await api.post('/calls/agent/pause', { reason });
    pause(reason);
    setPauseReason(reason);
  };

  const handleResume = async () => {
    setResumeLoading(true);
    try {
      await api.post('/calls/agent/resume');
      resume();
      setPauseReason('');
      // En mode PREDICTIF : démarrer le dialer si une campagne est sélectionnée
      if (campDialerMode === 'PREDICTIVE' && selectedCamp) {
        api.post('/calls/dialer/start', {
          campaignId: selectedCamp,
          mode: 'PREDICTIVE',
          ratio: 1.2,
        }).catch(() => {});
      }
    } finally {
      setResumeLoading(false);
    }
  };

  const handleHangup = () => hangup('');

  // ─── Écran connexion ──────────────────────────────────────────────────────────

  if (!logged) {
    return (
      <div className="max-w-sm mx-auto mt-8 space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Connexion Agent</h1>
          <p className="text-gray-500 text-sm mt-1">Entrez votre extension SIP pour commencer</p>
        </div>
        <div className="card p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extension SIP</label>
            <input value={extension} onChange={(e) => setExtension(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="ex: 1000" className="input-field text-center text-xl font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campagne (optionnel)</label>
            <select value={selectedCamp} onChange={e => setSelectedCamp(e.target.value)} className="input-field">
              <option value="">— Aucune campagne sélectionnée —</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Vous pourrez en changer après connexion</p>
          </div>
          <button onClick={handleLogin} disabled={!extension.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3">
            <Phone size={18} /> Se connecter
          </button>
        </div>
      </div>
    );
  }

  const availability = agentState?.availability ?? 'AVAILABLE';
  const canCallManual = availability === 'AVAILABLE' && !activeCall && !wrapUp && !incomingCall;
  const isInCall = availability === 'IN_CALL' || !!activeCall || !!incomingCall;

  // ─── Espace agent connecté (layout 2 colonnes) ────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Barre de statut */}
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 space-y-2">
        {/* Ligne 1 : infos connexion */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={clsx('w-2.5 h-2.5 rounded-full', AVAIL_COLORS[availability])} />
              <span className="text-sm font-medium text-gray-700">{AVAIL_LABELS[availability]}</span>
            </div>
            <span className="text-xs text-gray-400 font-mono border-l pl-3">Ext. {extension}</span>
            <span className={clsx('flex items-center gap-1 text-xs border-l pl-3', connected ? 'text-green-600' : 'text-red-500')}>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {connected ? 'En ligne' : 'Déconnecté'}
            </span>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors">
            <LogOut size={13} /> Déconnexion
          </button>
        </div>

        {/* Ligne 2 : boutons d'action */}
        <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-100">
          {/* Raccrocher — rouge */}
          <button onClick={handleHangup} disabled={!isInCall}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
              isInCall ? 'bg-red-500 hover:bg-red-600 text-white shadow-sm' : 'bg-red-100 text-red-300 cursor-not-allowed',
            )}>
            <PhoneOff size={13} /> Raccrocher
          </button>

          {/* Reprendre — vert */}
          <button onClick={handleResume} disabled={availability === 'AVAILABLE' || isInCall}
            className={clsx(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all',
              availability !== 'AVAILABLE' && !isInCall
                ? 'bg-green-500 hover:bg-green-600 text-white shadow-sm'
                : 'bg-green-100 text-green-300 cursor-not-allowed',
            )}>
            <Play size={13} /> Reprendre
          </button>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Pause générique */}
          <button onClick={() => handlePause('PAUSED')} disabled={availability !== 'AVAILABLE'}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border',
              availability === 'AVAILABLE'
                ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border-orange-300'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed border-gray-200',
            )}>
            <Pause size={12} /> Pause
          </button>

          {/* Raisons de pause spécifiques */}
          {PAUSE_REASONS.map((r) => (
            <button key={r.key} onClick={() => handlePause(r.key)} disabled={availability !== 'AVAILABLE'}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border',
                availability === 'AVAILABLE'
                  ? 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                  : 'bg-gray-50 text-gray-300 cursor-not-allowed border-gray-100',
              )}>
              {r.icon} {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Layout 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4 items-start">

        {/* ── Colonne gauche : zone appel ────────────────────────────────────── */}
        <div className="space-y-4">

          {/* Sélecteur campagne + appel manuel */}
          <div className="card p-4 flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 mb-1">Campagne active</label>
              <select value={selectedCamp} onChange={async (e) => {
                const val = e.target.value;
                setSelectedCamp(val);
                try { await api.patch('/calls/agent/campaign', { campaignId: val || null }); } catch {}
              }} className="input-field text-sm">
                <option value="">— Aucune campagne —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {canCallManual && (
              <button onClick={() => setShowManual(v => !v)}
                className={clsx('flex items-center gap-2 text-sm px-4 py-2.5 rounded-lg font-medium transition-colors mt-4',
                  showManual ? 'bg-primary-100 text-primary-700 border border-primary-300' : 'btn-secondary')}>
                <PhoneCall size={15} /> {showManual ? 'Fermer' : 'Appel manuel'}
              </button>
            )}
          </div>

          {/* Appel manuel */}
          {showManual && canCallManual && (
            <ManualCallPanel extension={extension} campaignId={selectedCamp || undefined} onClose={() => setShowManual(false)} />
          )}

          {/* Appel entrant */}
          {incomingCall && !activeCall && (
            <div className="card p-5 border-2 border-blue-400 bg-blue-50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center animate-pulse">
                  <Phone size={20} />
                </div>
                <div>
                  <p className="font-semibold text-blue-900">Appel entrant</p>
                  <p className="text-sm text-blue-700">
                    {incomingCall.lead
                      ? `${incomingCall.lead.firstName} ${incomingCall.lead.lastName} — ${incomingCall.lead.phone}`
                      : incomingCall.callerNumber}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Appel actif */}
          {activeCall && (
            <div className="card p-5 border-2 border-green-400">
              <CallPanel
                callId={activeCall.callId}
                lead={incomingCall?.lead}
                callerNumber={incomingCall?.callerNumber}
                startedAt={activeCall.startedAt}
                isMuted={isMuted}
                onMute={setIsMuted}
                onHangup={() => hangup('')}
                onDispositionSaved={() => {}}
              />
            </div>
          )}

          {/* Wrap-up — masqué en mode PREDICTIF (PostCallModal obligatoire prend le relais) */}
          {wrapUp && !activeCall && campDialerMode !== 'PREDICTIVE' && (
            <WrapUpPanel callId={wrapUp.callId} onDone={endWrapUp} />
          )}

          {/* Qualification rapide (pendant/après appel) */}
          {(activeCall || wrapUp) && (
            <div className="card p-4">
              <QuickQualification
                callLogId={callLogId}
                campaignId={selectedCamp || undefined}
                onSaved={() => { setCallLogId(null); fetchHistory(); }}
              />
            </div>
          )}

          {/* En attente */}
          {availability === 'AVAILABLE' && !incomingCall && !activeCall && !wrapUp && !showManual && (
            <div className="card px-8 py-5 text-center text-gray-400 border-dashed">
              <Phone size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="font-medium text-sm">En attente d'appel...</p>
              <p className="text-xs mt-0.5">Vous serez notifié dès qu'un appel arrive</p>
            </div>
          )}

          {/* Fiche client — toujours visible dans la colonne principale */}
          <div className="card p-6">
            <ClientFiche lead={currentLead} />
          </div>

          <Softphone config={sipConfig} />
        </div>

        {/* ── Colonne droite : sidebar contextuelle ─────────────────────────── */}
        <div className="card overflow-hidden">
          {/* Onglets sidebar */}
          <div className="flex border-b border-gray-100">
            {([
              { key: 'script',     icon: FileText, label: 'Script' },
              { key: 'rappels',    icon: Bell,     label: 'Rappels' },
              { key: 'historique', icon: History,  label: 'Historique' },
            ] as { key: SideTab; icon: React.ElementType; label: string }[]).map(({ key, icon: Icon, label }) => (
              <button key={key} onClick={() => setSideTab(key)}
                className={clsx('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors border-b-2',
                  sideTab === key
                    ? 'border-primary-600 text-primary-700 bg-primary-50/40'
                    : 'border-transparent text-gray-500 hover:text-gray-700')}>
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          <div className="p-4 min-h-80 max-h-[calc(100vh-220px)] overflow-y-auto">
            {/* Script */}
            {sideTab === 'script' && (
              <div className="space-y-3">
                {scripts.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">
                    {selectedCamp ? 'Aucun script pour cette campagne' : 'Sélectionnez une campagne pour voir les scripts'}
                  </p>
                ) : (
                  <>
                    <select className="input-field text-sm"
                      value={activeScript?.id ?? ''}
                      onChange={e => setActiveScript(scripts.find(s => s.id === e.target.value) ?? null)}>
                      <option value="">— Choisir un script —</option>
                      {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                    {activeScript && (
                      <ScriptPlayer
                        scriptId={activeScript.id}
                        callId={activeCall?.callId}
                        campaignId={selectedCamp || undefined}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Rappels */}
            {sideTab === 'rappels' && (
              <div className="space-y-2">
                {callbacks.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun rappel en attente</p>
                ) : callbacks.map((cb) => (
                  <div key={cb.id} className="flex items-center justify-between bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cb.firstName} {cb.lastName}</p>
                      <p className="text-xs text-gray-500 font-mono">{cb.phone}</p>
                    </div>
                    <button
                      onClick={() => api.post('/calls/originate', { destination: cb.phone, agentExtension: extension })}
                      className="text-xs btn-primary px-2.5 py-1.5 flex items-center gap-1">
                      <Phone size={11} /> Rappeler
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Historique */}
            {sideTab === 'historique' && (
              <div className="space-y-2">
                {recentLogs.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">Aucun appel récent</p>
                ) : recentLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2">
                      {log.call?.direction === 'INBOUND'
                        ? <PhoneForwarded size={13} className="text-blue-500" />
                        : log.qualification === 'NO_ANSWER'
                        ? <PhoneMissed size={13} className="text-orange-400" />
                        : <Phone size={13} className="text-green-500" />}
                      <div>
                        <p className="text-xs font-medium text-gray-800">{log.callerNumber}</p>
                        <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {log.qualification && (
                        <span className="text-xs text-gray-500">{log.qualification}</span>
                      )}
                      <p className="text-xs text-gray-400">{fmt(log.durationSec)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <button onClick={() => triggerPostCall({ callId: 'test-' + Date.now() })}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-60 hover:opacity-100">
          Simuler fin d'appel
        </button>
      )}

      {/* Overlay pause — bloque toute interaction tant que l'agent n'a pas repris */}
      {availability === 'PAUSED' && pauseReason && (
        <PauseOverlay
          reason={pauseReason}
          onResume={handleResume}
          loading={resumeLoading}
        />
      )}

      {/* Widget chat manager — flottant, visible dès que l'agent est sur la page */}
      <AgentManagerChat
        messages={chatMessages}
        unread={chatUnread}
        onReply={replyToManager}
        onClearUnread={clearChatUnread}
      />

      {postCallData && (
        <PostCallModal
          callId={postCallData.callId}
          callLogId={postCallData.callLogId}
          mandatory={campDialerMode === 'PREDICTIVE'}
          onClose={() => setPostCallData(null)}
          onNextCall={() => {
            setPostCallData(null);
            // En mode prédictif, signale au dialer que l'agent est disponible pour le prochain appel
            if (campDialerMode === 'PREDICTIVE') endWrapUp();
          }}
        />
      )}
    </div>
  );
}
