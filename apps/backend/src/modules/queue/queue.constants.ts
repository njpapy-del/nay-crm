// ── Queue names ───────────────────────────────────────────────────────────────
export const QUEUE_AI_SUMMARY     = 'ai-summary';
export const QUEUE_AI_SCORING     = 'ai-scoring';
export const QUEUE_AI_SUGGESTIONS = 'ai-suggestions';
export const QUEUE_AI_PERFORMANCE = 'ai-performance';

// ── Job names ─────────────────────────────────────────────────────────────────
export const JOB_SUMMARIZE   = 'summarize_call';
export const JOB_SCORE       = 'score_call';
export const JOB_SUGGEST     = 'suggest_script';
export const JOB_PERFORMANCE = 'analyze_agent';

// ── Default job options ───────────────────────────────────────────────────────
export const AI_JOB_OPTS = {
  attempts:         3,
  backoff:          { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { age: 86_400 },    // garder 24h après complétion
  removeOnFail:     { age: 604_800 },   // garder 7 jours si erreur
} as const;

// ── Payload partagé ───────────────────────────────────────────────────────────
export interface AiJobPayload {
  jobId:    string;  // AiJob.id en base
  tenantId: string;
  userId:   string;
}
