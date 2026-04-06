'use client';

import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import {
  BrainCircuit, FileText, Star, Lightbulb, TrendingUp,
  Loader2, Lock, CheckCircle2, XCircle, RefreshCw, ChevronDown,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'summary' | 'scoring' | 'suggestions' | 'performance';
type JobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

interface AiJob {
  jobId: string;
  status: JobStatus;
}

interface AiResult {
  id: string;
  type: string;
  status: JobStatus;
  result: Record<string, any> | null;
  error: string | null;
  processingMs: number | null;
  createdAt: string;
}

interface Quota {
  plan: string;
  isPremium: boolean;
  quota: number;
  used: number;
  remaining: number;
  month: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const api = axios.create({ baseURL: process.env.NEXT_PUBLIC_BACKEND_URL });

const TABS = [
  { id: 'summary'     as TabId, label: 'Résumé',       icon: FileText,    roles: ['ADMIN','MANAGER','AGENT','QUALITY'] },
  { id: 'scoring'     as TabId, label: 'Scoring',      icon: Star,        roles: ['ADMIN','MANAGER','QUALITY'] },
  { id: 'suggestions' as TabId, label: 'Suggestions',  icon: Lightbulb,   roles: ['ADMIN','MANAGER'] },
  { id: 'performance' as TabId, label: 'Performance',  icon: TrendingUp,  roles: ['ADMIN','MANAGER'] },
];

function StatusBadge({ status }: { status: JobStatus }) {
  const map = {
    PENDING:    'bg-yellow-100 text-yellow-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    COMPLETED:  'bg-green-100 text-green-700',
    FAILED:     'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${map[status]}`}>
      {status}
    </span>
  );
}

// ─── Composant résultat générique ─────────────────────────────────────────────

function ResultPanel({ result, type }: { result: Record<string, any>; type: string }) {
  if (type === 'SUMMARY') return (
    <div className="space-y-4">
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Résumé</p>
        <p className="text-sm text-gray-700">{result.summary}</p>
      </div>
      {result.keyPoints?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Points clés</p>
          <ul className="list-disc list-inside space-y-1">
            {result.keyPoints.map((p: string, i: number) => (
              <li key={i} className="text-sm text-gray-700">{p}</li>
            ))}
          </ul>
        </div>
      )}
      {result.clientIntent && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Intention client</p>
          <p className="text-sm text-indigo-700 font-medium">{result.clientIntent}</p>
        </div>
      )}
      {result.nextAction && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-1">Action recommandée</p>
          <p className="text-sm text-emerald-700 font-medium">{result.nextAction}</p>
        </div>
      )}
    </div>
  );

  if (type === 'SCORING') return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-20 h-20 rounded-full bg-indigo-50 border-4 border-indigo-500 flex items-center justify-center">
          <span className="text-2xl font-bold text-indigo-600">{result.score}</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-700 mb-2">Détail par critère</p>
          {result.breakdown && Object.entries(result.breakdown).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 mb-1">
              <span className="text-xs text-gray-500 w-36 truncate">{k}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${((v as number) / 25) * 100}%` }} />
              </div>
              <span className="text-xs font-medium text-gray-700 w-8 text-right">{v as number}/25</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-sm text-gray-700">{result.feedback}</p>
      {result.strengths?.length > 0 && (
        <div>
          <p className="text-xs text-green-600 font-semibold uppercase mb-1">Points forts</p>
          {result.strengths.map((s: string, i: number) => (
            <p key={i} className="text-sm text-gray-700">✓ {s}</p>
          ))}
        </div>
      )}
      {result.improvements?.length > 0 && (
        <div>
          <p className="text-xs text-orange-500 font-semibold uppercase mb-1">Axes d'amélioration</p>
          {result.improvements.map((s: string, i: number) => (
            <p key={i} className="text-sm text-gray-700">→ {s}</p>
          ))}
        </div>
      )}
    </div>
  );

  if (type === 'SUGGESTIONS') return (
    <div className="space-y-4">
      {result.improvements?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Améliorations prioritaires</p>
          {result.improvements.map((s: string, i: number) => (
            <p key={i} className="text-sm text-gray-700 mb-1">• {s}</p>
          ))}
        </div>
      )}
      {result.optimizedPhrases?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Formulations optimisées</p>
          {result.optimizedPhrases.map((p: any, i: number) => (
            <div key={i} className="mb-2 text-sm">
              <span className="line-through text-red-400">{p.before}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="text-emerald-600 font-medium">{p.after}</span>
            </div>
          ))}
        </div>
      )}
      {result.objectionHandlers?.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 font-semibold uppercase mb-2">Gestion des objections</p>
          {result.objectionHandlers.map((o: any, i: number) => (
            <div key={i} className="mb-3 border-l-2 border-indigo-300 pl-3">
              <p className="text-xs text-red-500 font-medium">{o.objection}</p>
              <p className="text-sm text-gray-700">{o.response}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (type === 'PERFORMANCE') return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-purple-50 border-4 border-purple-500 flex items-center justify-center">
          <span className="text-xl font-bold text-purple-600">{result.performanceScore}</span>
        </div>
        <p className="text-sm text-gray-700 flex-1">{result.summary}</p>
      </div>
      {result.strengths?.length > 0 && (
        <div>
          <p className="text-xs text-green-600 font-semibold uppercase mb-1">Points forts</p>
          {result.strengths.map((s: string, i: number) => <p key={i} className="text-sm text-gray-700">✓ {s}</p>)}
        </div>
      )}
      {result.weaknesses?.length > 0 && (
        <div>
          <p className="text-xs text-orange-500 font-semibold uppercase mb-1">Axes faibles</p>
          {result.weaknesses.map((s: string, i: number) => <p key={i} className="text-sm text-gray-700">✗ {s}</p>)}
        </div>
      )}
      {result.trainingPlan?.length > 0 && (
        <div>
          <p className="text-xs text-indigo-600 font-semibold uppercase mb-1">Plan de formation</p>
          {result.trainingPlan.map((s: string, i: number) => (
            <p key={i} className="text-sm text-gray-700">{i + 1}. {s}</p>
          ))}
        </div>
      )}
    </div>
  );

  return <pre className="text-xs text-gray-500 overflow-auto">{JSON.stringify(result, null, 2)}</pre>;
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function AiAnalyticsPage() {
  const { user } = useAuthStore();
  const role = user?.role ?? 'AGENT';

  const [activeTab,   setActiveTab]   = useState<TabId>('summary');
  const [quota,       setQuota]       = useState<Quota | null>(null);
  const [history,     setHistory]     = useState<AiResult[]>([]);
  const [pendingJob,  setPendingJob]  = useState<AiJob | null>(null);
  const [polling,     setPolling]     = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');

  // Formulaires
  const [transcription, setTranscription] = useState('');
  const [agentId,       setAgentId]       = useState('');
  const [periodDays,    setPeriodDays]    = useState(30);

  // ── Quota ───────────────────────────────────────────────────────────────────
  const fetchQuota = useCallback(async () => {
    try {
      const r = await api.get('/ai-analytics/quota');
      setQuota(r.data?.data ?? r.data);
    } catch {}
  }, []);

  // ── Historique ──────────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const r = await api.get('/ai-analytics/history?limit=10');
      const d = r.data?.data ?? r.data;
      setHistory(Array.isArray(d) ? d : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchQuota();
    fetchHistory();
  }, [fetchQuota, fetchHistory]);

  // ── Polling résultat ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!pendingJob || !polling) return;
    const interval = setInterval(async () => {
      try {
        const r = await api.get(`/ai-analytics/result/${pendingJob.jobId}`);
        const job: AiResult = r.data?.data ?? r.data;
        if (job.status === 'COMPLETED' || job.status === 'FAILED') {
          setPendingJob(null);
          setPolling(false);
          fetchHistory();
          fetchQuota();
        }
      } catch {}
    }, 2_000);
    return () => clearInterval(interval);
  }, [pendingJob, polling, fetchHistory, fetchQuota]);

  // ── Soumettre ────────────────────────────────────────────────────────────────
  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      let r: any;
      const text = transcription.trim();

      if (activeTab === 'summary')     r = await api.post('/ai-analytics/summarize', { transcription: text });
      if (activeTab === 'scoring')     r = await api.post('/ai-analytics/score',     { transcription: text });
      if (activeTab === 'suggestions') r = await api.post('/ai-analytics/suggest',   { content: text });
      if (activeTab === 'performance') r = await api.post('/ai-analytics/performance',{ agentId, periodDays });

      const job: AiJob = r.data?.data ?? r.data;
      setPendingJob(job);
      setPolling(true);
    } catch (e: any) {
      setError(e.response?.data?.message ?? 'Erreur lors de la soumission');
    } finally {
      setLoading(false);
    }
  };

  const visibleTabs = TABS.filter((t) => t.roles.includes(role));

  // ── Gate plan insuffisant ────────────────────────────────────────────────────
  if (quota && !quota.isPremium) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 gap-6">
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-10 text-center max-w-md">
          <Lock className="w-12 h-12 text-indigo-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Fonctionnalité Premium</h2>
          <p className="text-gray-500 text-sm mb-6">
            L'IA analytique est disponible uniquement en plan <strong>PRO</strong> ou <strong>ENTREPRISE</strong>.
          </p>
          <a href="/account/subscription"
             className="inline-block bg-indigo-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition">
            Passer à un plan supérieur
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrainCircuit className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">IA Analytique</h1>
            <p className="text-xs text-gray-400">Analyses post-appel • Scoring • Suggestions • Performance</p>
          </div>
          <span className="ml-2 text-xs font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">Premium</span>
        </div>
        {quota && (
          <div className="text-right">
            <p className="text-xs text-gray-400">Quota {quota.month}</p>
            <p className="text-sm font-semibold text-gray-700">{quota.used} / {quota.quota} analyses</p>
            <div className="w-32 bg-gray-100 rounded-full h-1.5 mt-1">
              <div className="bg-indigo-500 h-1.5 rounded-full"
                   style={{ width: `${Math.min(100, (quota.used / quota.quota) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {visibleTabs.map((tab) => (
          <button key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        {activeTab === 'performance' ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">ID Agent</label>
              <input value={agentId} onChange={(e) => setAgentId(e.target.value)}
                placeholder="ID de l'agent à analyser"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Période (jours)</label>
              <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
                <option value={7}>7 jours</option>
                <option value={30}>30 jours</option>
                <option value={60}>60 jours</option>
                <option value={90}>90 jours</option>
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              {activeTab === 'suggestions' ? 'Script ou transcription' : 'Transcription d\'appel'}
            </label>
            <textarea value={transcription} onChange={(e) => setTranscription(e.target.value)}
              rows={6} placeholder="Collez la transcription ou le texte à analyser..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
            <XCircle size={15} />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{quota?.remaining ?? '?'} analyses restantes ce mois</p>
          <button onClick={submit} disabled={loading || polling || quota?.remaining === 0}
            className="flex items-center gap-2 bg-indigo-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
            {loading || polling
              ? <><Loader2 size={15} className="animate-spin" /> Analyse en cours…</>
              : <><BrainCircuit size={15} /> Lancer l'analyse</>}
          </button>
        </div>

        {/* Job en attente */}
        {pendingJob && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-600">
            <RefreshCw size={14} className="animate-spin" />
            Traitement en cours — résultat dans quelques secondes…
          </div>
        )}
      </div>

      {/* Historique */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Analyses récentes</p>
            <button onClick={fetchHistory} className="text-xs text-indigo-600 hover:underline flex items-center gap-1">
              <RefreshCw size={12} /> Actualiser
            </button>
          </div>
          {history.map((item) => (
            <details key={item.id} className="group px-5 py-3">
              <summary className="flex items-center gap-3 cursor-pointer list-none">
                <StatusBadge status={item.status} />
                <span className="text-xs font-medium text-gray-600 uppercase">{item.type}</span>
                <span className="flex-1 text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleString('fr-FR')}
                  {item.processingMs ? ` · ${(item.processingMs / 1000).toFixed(1)}s` : ''}
                </span>
                {item.status === 'COMPLETED' && <CheckCircle2 size={14} className="text-green-500" />}
                {item.status === 'FAILED'    && <XCircle size={14} className="text-red-500" />}
                <ChevronDown size={14} className="text-gray-400 group-open:rotate-180 transition-transform" />
              </summary>
              <div className="mt-3 pl-2">
                {item.status === 'COMPLETED' && item.result && (
                  <ResultPanel result={item.result} type={item.type} />
                )}
                {item.status === 'FAILED' && (
                  <p className="text-sm text-red-500">{item.error}</p>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
