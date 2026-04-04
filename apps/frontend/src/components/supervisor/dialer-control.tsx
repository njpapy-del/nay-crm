'use client';

import { useCallback, useEffect, useState } from 'react';
import { Play, Square, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import { clsx } from 'clsx';

interface Campaign { id: string; name: string; status: string; _count: { leads: number }; }
interface DialerSession { campaignId: string; mode: string; active: boolean; }

export function DialerControl() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sessions, setSessions] = useState<DialerSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [mode, setMode] = useState<'PROGRESSIVE' | 'PREDICTIVE' | 'PREVIEW'>('PROGRESSIVE');

  const fetchData = useCallback(async () => {
    const [campRes, sessRes] = await Promise.all([
      api.get('/campaigns?status=ACTIVE&limit=50'),
      api.get('/calls/dialer/sessions'),
    ]);
    setCampaigns(campRes.data.data);
    setSessions(sessRes.data.data);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isRunning = (id: string) => sessions.some((s) => s.campaignId === id && s.active);

  const start = async () => {
    if (!selectedId) return;
    await api.post('/calls/dialer/start', { campaignId: selectedId, mode });
    fetchData();
  };

  const stop = async (campaignId: string) => {
    await api.post(`/calls/dialer/stop/${campaignId}`);
    fetchData();
  };

  return (
    <div className="space-y-4">
      {/* Contrôle lancement */}
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Campagne</label>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="input-field text-sm">
            <option value="">Sélectionner...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c._count.leads} leads)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Mode</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(['PROGRESSIVE', 'PREDICTIVE', 'PREVIEW'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={clsx('px-2 py-1.5 rounded text-xs font-medium border transition-colors',
                  mode === m ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300')}>
                {m === 'PROGRESSIVE' ? 'Progressif' : m === 'PREDICTIVE' ? 'Prédictif' : 'Prévisuel'}
              </button>
            ))}
          </div>
        </div>
        <button onClick={start} disabled={!selectedId || isRunning(selectedId)}
          className="w-full btn-primary flex items-center justify-center gap-2 text-sm">
          <Play size={15} /> Démarrer le dialer
        </button>
      </div>

      {/* Sessions actives */}
      {sessions.filter((s) => s.active).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase">Sessions actives</p>
          {sessions.filter((s) => s.active).map((s) => {
            const camp = campaigns.find((c) => c.id === s.campaignId);
            return (
              <div key={s.campaignId} className="flex items-center justify-between p-2.5 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Zap size={14} className="text-green-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{camp?.name ?? s.campaignId}</p>
                    <p className="text-xs text-gray-500">{s.mode}</p>
                  </div>
                </div>
                <button onClick={() => stop(s.campaignId)}
                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Square size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
