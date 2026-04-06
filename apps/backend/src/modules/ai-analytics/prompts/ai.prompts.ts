// ─── Prompts IA — module analytique ──────────────────────────────────────────
// ⚠️  Ces prompts sont SÉPARÉS du chatbot conversationnel (chatbot/)
// ─────────────────────────────────────────────────────────────────────────────

export const PROMPTS = {

  // ── 1. Résumé d'appel ────────────────────────────────────────────────────

  summary: (text: string) => `
Tu es un expert en analyse d'appels de vente. Analyse la transcription et génère un résumé professionnel.

Réponds UNIQUEMENT en JSON valide (sans markdown, sans texte autour) :
{
  "summary": "résumé en 3 phrases max",
  "keyPoints": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "clientIntent": "intention principale du client en 1 phrase",
  "nextAction": "action recommandée suite à cet appel"
}

Transcription :
${text}`.trim(),

  // ── 2. Scoring qualité ───────────────────────────────────────────────────

  scoring: (text: string) => `
Tu es un expert en management de call center. Analyse cet appel et évalue chaque critère.

Réponds UNIQUEMENT en JSON valide (sans markdown, sans texte autour) :
{
  "score": <entier 0-100>,
  "breakdown": {
    "scriptCompliance":   <entier 0-25>,
    "argumentation":      <entier 0-25>,
    "closing":            <entier 0-25>,
    "objectionHandling":  <entier 0-25>
  },
  "feedback": "analyse globale en 2-3 phrases",
  "strengths":    ["point fort 1", "point fort 2"],
  "improvements": ["axe amélioration 1", "axe amélioration 2", "axe amélioration 3"]
}

Appel à analyser :
${text}`.trim(),

  // ── 3. Suggestions script ────────────────────────────────────────────────

  suggestions: (text: string) => `
Tu es un expert en scripts de vente commerciale. Analyse ce script ou transcription d'appel.

Réponds UNIQUEMENT en JSON valide (sans markdown, sans texte autour) :
{
  "improvements": ["amélioration prioritaire 1", "amélioration prioritaire 2", "amélioration prioritaire 3"],
  "optimizedPhrases": [
    { "before": "formulation actuelle", "after": "formulation optimisée" }
  ],
  "objectionHandlers": [
    { "objection": "objection probable", "response": "réponse recommandée" }
  ],
  "conversionTips": ["conseil conversion 1", "conseil conversion 2"]
}

Script / transcription :
${text}`.trim(),

  // ── 4. Analyse performance agent ─────────────────────────────────────────

  performance: (stats: string) => `
Tu es un expert en coaching commercial. Analyse les statistiques de performance de cet agent.

Réponds UNIQUEMENT en JSON valide (sans markdown, sans texte autour) :
{
  "performanceScore": <entier 0-100>,
  "strengths":    ["point fort 1", "point fort 2", "point fort 3"],
  "weaknesses":   ["axe faible 1", "axe faible 2", "axe faible 3"],
  "trainingPlan": [
    "action formation concrète 1",
    "action formation concrète 2",
    "action formation concrète 3"
  ],
  "summary": "analyse globale de l'agent en 3-4 phrases",
  "priority": "domaine prioritaire à améliorer en urgence"
}

Statistiques agent :
${stats}`.trim(),

};
