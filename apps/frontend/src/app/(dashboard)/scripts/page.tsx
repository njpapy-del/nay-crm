'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, Pencil, Trash2, ToggleLeft, ToggleRight, Download, Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Script {
  id: string;
  title: string;
  description?: string;
  isActive: boolean;
  campaign?: { id: string; name: string };
  createdBy: { firstName: string; lastName: string };
  _count: { fields: number; responses: number };
  createdAt: string;
}

interface Campaign { id: string; name: string }

export default function ScriptsPage() {
  const router = useRouter();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState({ title: '', description: '', campaignId: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [sRes, cRes] = await Promise.all([
      api.get('/scripts').catch(() => ({ data: { data: [] } })),
      api.get('/campaigns?limit=100').catch(() => ({ data: { data: [] } })),
    ]);
    setScripts(sRes.data?.data ?? sRes.data ?? []);
    setCampaigns(cRes.data?.data ?? cRes.data ?? []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm({ title: '', description: '', campaignId: '' });
    setShowModal(true);
  }

  function openEdit(s: Script) {
    setEditing(s);
    setForm({ title: s.title, description: s.description ?? '', campaignId: s.campaign?.id ?? '' });
    setShowModal(true);
  }

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = { title: form.title, description: form.description || undefined, campaignId: form.campaignId || undefined };
      if (editing) {
        await api.patch(`/scripts/${editing.id}`, payload);
      } else {
        await api.post('/scripts', payload);
      }
      setShowModal(false);
      load();
    } finally { setSaving(false); }
  }

  async function toggleActive(s: Script) {
    await api.patch(`/scripts/${s.id}`, { isActive: !s.isActive });
    load();
  }

  async function remove(s: Script) {
    if (!confirm(`Supprimer le script "${s.title}" ?`)) return;
    await api.delete(`/scripts/${s.id}`);
    load();
  }

  async function exportCsv(s: Script) {
    const res = await api.get(`/scripts/${s.id}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url; a.download = `script_${s.title}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scripts d'appel</h1>
          <p className="text-sm text-gray-500 mt-1">Gérez vos scripts et formulaires pour guider les agents</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Nouveau script
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : scripts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Aucun script créé</p>
          <p className="text-sm">Créez votre premier script d'appel</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts.map(s => (
            <div key={s.id} className={clsx(
              'bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow',
              !s.isActive && 'opacity-60',
            )}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{s.title}</h3>
                  {s.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.description}</p>}
                </div>
                <span className={clsx('shrink-0 text-xs px-2 py-0.5 rounded-full font-medium', s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                  {s.isActive ? 'Actif' : 'Inactif'}
                </span>
              </div>

              {s.campaign && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full w-fit">
                  {s.campaign.name}
                </span>
              )}

              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{s._count.fields} champ{s._count.fields !== 1 ? 's' : ''}</span>
                <span>•</span>
                <span>{s._count.responses} réponse{s._count.responses !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center gap-1 mt-auto pt-2 border-t border-gray-100">
                <button onClick={() => router.push(`/scripts/${s.id}/builder`)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors">
                  <Pencil size={13} /> Éditer
                </button>
                <button onClick={() => router.push(`/scripts/${s.id}/responses`)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg hover:bg-gray-50 text-gray-600 font-medium transition-colors">
                  <Eye size={13} /> Réponses
                </button>
                <button onClick={() => exportCsv(s)}
                  className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors" title="Export CSV">
                  <Download size={14} />
                </button>
                <button onClick={() => toggleActive(s)}
                  className="p-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors">
                  {s.isActive ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
                </button>
                <button onClick={() => openEdit(s)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                  <Pencil size={14} />
                </button>
                <button onClick={() => remove(s)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal create/edit */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">{editing ? 'Modifier le script' : 'Nouveau script'}</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
              <input className="input w-full" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Script entrant - Prospect" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea className="input w-full resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campagne associée</label>
              <select className="input w-full" value={form.campaignId} onChange={e => setForm(f => ({ ...f, campaignId: e.target.value }))}>
                <option value="">— Aucune —</option>
                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={save} disabled={!form.title || saving} className="btn-primary flex-1">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
