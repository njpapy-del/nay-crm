'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  PhoneCall, Download, Search, Filter, Loader2, CheckCircle,
  Clock, User, ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface CallLog {
  id: string; callerNumber: string; calleeNumber: string;
  durationSec: number; qualification?: string; status: string;
  notes?: string; agentNotes?: string; createdAt: string;
  agent?: { id: string; firstName: string; lastName: string };
  campaign?: { id: string; name: string };
  call: {
    id: string; direction: string; status: string;
    client?: { id: string; firstName: string; lastName: string };
    lead?: { id: string; firstName: string; lastName: string };
    recording?: { id: string; durationSec: number };
  };
}

const QUALIF_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'À rappeler', WRONG_NUMBER: 'Faux numéro', VOICEMAIL: 'Répondeur',
  DNC: 'DNC', OTHER: 'Autre',
};

const QUALIF_COLORS: Record<string, string> = {
  SALE:           'bg-green-100 text-green-700',
  APPOINTMENT:    'bg-blue-100 text-blue-700',
  NOT_INTERESTED: 'bg-red-100 text-red-700',
  CALLBACK:       'bg-yellow-100 text-yellow-700',
  WRONG_NUMBER:   'bg-gray-100 text-gray-600',
  VOICEMAIL:      'bg-purple-100 text-purple-700',
  DNC:            'bg-red-100 text-red-800',
  OTHER:          'bg-gray-100 text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   'bg-gray-100 text-gray-600',
  QUALIFIED: 'bg-blue-100 text-blue-700',
  REVIEWED:  'bg-green-100 text-green-700',
};

function fmtDur(s: number) {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function QualifSelect({ log, onUpdate }: { log: CallLog; onUpdate: () => void }) {
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState(log.notes ?? '');
  const [expanded, setExpanded] = useState(false);

  const update = async (patch: Record<string, any>) => {
    setSaving(true);
    try {
      await api.patch(`/call-logs/${log.id}`, patch);
      onUpdate();
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <select
          value={log.qualification ?? ''}
          onChange={(e) => update({ qualification: e.target.value || null, status: 'QUALIFIED' })}
          disabled={saving}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary-300 bg-white">
          <option value="">— Non qualifié —</option>
          {Object.entries(QUALIF_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
        <button onClick={() => setExpanded((v) => !v)}
          className="p-1 text-gray-400 hover:text-gray-600 rounded">
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 flex gap-2">
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…" className="input-field text-xs flex-1" />
          <button onClick={() => update({ notes, status: 'REVIEWED' })}
            disabled={saving}
            className="btn-primary text-xs px-2 flex items-center gap-1 disabled:opacity-50">
            <CheckCircle size={11} /> OK
          </button>
        </div>
      )}
    </div>
  );
}

export default function CallLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const [agentSearch, setAgentSearch] = useState('');
  const [phone, setPhone]             = useState('');
  const [qualification, setQualif]    = useState('');
  const [status, setStatus]           = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [campaigns, setCampaigns]     = useState<any[]>([]);
  const [campaignId, setCampaignId]   = useState('');

  const LIMIT = 30;

  useEffect(() => {
    api.get('/campaigns?limit=100').then((r) => setCampaigns(r.data.data ?? [])).catch(() => {});
    api.get('/call-logs/stats').then((r) => setStats(r.data.data ?? r.data)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (agentSearch) params.set('search', agentSearch);
      if (phone)       params.set('phone', phone);
      if (qualification) params.set('qualification', qualification);
      if (status)      params.set('status', status);
      if (campaignId)  params.set('campaignId', campaignId);
      if (dateFrom)    params.set('dateFrom', dateFrom);
      if (dateTo)      params.set('dateTo', dateTo);
      const res = await api.get(`/call-logs?${params}`);
      setLogs(res.data.data ?? []);
      setTotal(res.data.total ?? 0);
    } finally { setLoading(false); }
  }, [page, agentSearch, phone, qualification, status, campaignId, dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (qualification) params.set('qualification', qualification);
    if (status)        params.set('status', status);
    if (dateFrom)      params.set('dateFrom', dateFrom);
    if (dateTo)        params.set('dateTo', dateTo);
    const res = await api.get(`/call-logs/export?${params}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'call-logs.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal des appels</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} appel{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} /> Exporter CSV
          </button>
          <button onClick={() => setShowFilters((v) => !v)}
            className={clsx('btn-secondary flex items-center gap-2 text-sm',
              showFilters && 'bg-primary-50 border-primary-300 text-primary-700')}>
            <Filter size={14} /> Filtres
          </button>
        </div>
      </div>

      {/* Stats rapides */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Ventes',    val: stats.byQualification?.SALE ?? 0,        color: 'text-green-600' },
            { label: 'RDV',       val: stats.byQualification?.APPOINTMENT ?? 0, color: 'text-blue-600'  },
            { label: 'Rappels',   val: stats.byQualification?.CALLBACK ?? 0,    color: 'text-yellow-600' },
            { label: 'À revoir',  val: stats.byStatus?.PENDING ?? 0,            color: 'text-gray-600'  },
          ].map((s) => (
            <div key={s.label} className="card p-3 text-center">
              <p className={clsx('text-2xl font-bold', s.color)}>{s.val}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      {showFilters && (
        <div className="card p-4 grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Agent</label>
            <input value={agentSearch} onChange={(e) => setAgentSearch(e.target.value)}
              placeholder="Nom…" className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Téléphone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+336…" className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Qualification</label>
            <select value={qualification} onChange={(e) => setQualif(e.target.value)}
              className="input-field text-sm mt-1 w-full">
              <option value="">Toutes</option>
              {Object.entries(QUALIF_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Statut</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="input-field text-sm mt-1 w-full">
              <option value="">Tous</option>
              <option value="PENDING">À revoir</option>
              <option value="QUALIFIED">Qualifié</option>
              <option value="REVIEWED">Révisé</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Date début</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Date fin</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="input-field text-sm mt-1 w-full" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase">Campagne</label>
            <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
              className="input-field text-sm mt-1 w-full">
              <option value="">Toutes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => { setPage(1); load(); }} className="btn-primary text-sm w-full">
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-300" /></div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <PhoneCall size={36} className="mx-auto mb-2 opacity-20" />
            <p className="text-sm">Aucun journal d'appel</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Date', 'Agent', 'De → Vers', 'Durée', 'Contact', 'Qualification', 'Statut', 'Enreg.', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const contact = log.call.client ?? log.call.lead;
                return (
                  <tr key={log.id} className="hover:bg-gray-50 align-top">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('fr-FR')}
                      <div className="text-gray-400">
                        {new Date(log.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.agent ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-gray-800">
                          <User size={11} className="text-gray-400" />
                          {log.agent.firstName} {log.agent.lastName}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      <div>{log.callerNumber}</div>
                      <div className="text-gray-400">→ {log.calleeNumber}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1 text-xs text-gray-600">
                        <Clock size={11} /> {fmtDur(log.durationSec)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {contact ? (
                        <span className="font-medium text-gray-800">
                          {contact.firstName} {contact.lastName}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <QualifSelect log={log} onUpdate={load} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full font-medium',
                        STATUS_COLORS[log.status] ?? 'bg-gray-100 text-gray-600')}>
                        {log.status === 'PENDING' ? 'À revoir' : log.status === 'QUALIFIED' ? 'Qualifié' : 'Révisé'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {log.call.recording ? (
                        <button onClick={() => router.push('/recordings')}
                          className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                          <ExternalLink size={11} /> Voir
                        </button>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Page {page}/{totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
              className="btn-secondary text-xs disabled:opacity-40">Préc.</button>
            <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-xs disabled:opacity-40">Suiv.</button>
          </div>
        </div>
      )}
    </div>
  );
}
