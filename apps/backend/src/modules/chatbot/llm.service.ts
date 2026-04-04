import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const LLM_TIMEOUT_MS = 35_000;

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const ollamaUrl = this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'gemma3:1b';
    this.logger.log(`Pre-warming Ollama model ${model}…`);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: 'Hi' }],
          stream: false,
          options: { num_predict: 5, num_ctx: 128 },
        }),
      });
      clearTimeout(t);
      if (res.ok) this.logger.log('Ollama pre-warm done ✓');
      else this.logger.warn(`Ollama pre-warm HTTP ${res.status}`);
    } catch (e: any) {
      this.logger.warn(`Ollama pre-warm failed: ${e.message}`);
    }
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    // 1. Groq (free tier)
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      try { return await this._groq(messages, groqKey); }
      catch (e: any) { this.logger.warn(`Groq: ${e.message}`); }
    }

    // 2. Ollama local
    const ollamaUrl = this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434';
    try { return await this._ollama(messages, ollamaUrl); }
    catch (e: any) { this.logger.warn(`Ollama: ${e.message} — fallback rule-based`); }

    // 3. Rule-based
    return this._ruleBased(messages);
  }

  // ── Groq ────────────────────────────────────────────────────────────
  private async _groq(messages: LlmMessage[], apiKey: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'llama3-8b-8192', messages, max_tokens: 200, temperature: 0.4 }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as any;
      return d.choices[0].message.content.trim();
    } finally { clearTimeout(t); }
  }

  // ── Ollama ───────────────────────────────────────────────────────────
  private async _ollama(messages: LlmMessage[], baseUrl: string): Promise<string> {
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'llama3.2:1b';
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
    try {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages, stream: false,
          options: { temperature: 0.4, num_predict: 150, num_ctx: 1024 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json() as any;
      return d.message?.content?.trim() ?? '';
    } finally { clearTimeout(t); }
  }

  // ── Rule-based ───────────────────────────────────────────────────────
  private _ruleBased(messages: LlmMessage[]): string {
    const last = messages.at(-1)?.content?.toLowerCase() ?? '';
    if (/rappel|reminder/.test(last)) return 'Consultez le panneau Rappels pour voir vos rappels en attente.';
    if (/qualit|alerte/.test(last)) return 'Aucune alerte qualité critique détectée pour le moment.';
    if (/bonjour|salut|hello|hi/.test(last)) return 'Bonjour ! Je suis votre assistant LNAYCRM. Comment puis-je vous aider ?';
    if (/aide|help/.test(last)) return 'Je peux vous aider avec vos rappels, les alertes qualité et les statistiques d\'appels.';
    if (/stat|kpi|chiffre/.test(last)) return 'Consultez le tableau de bord pour vos statistiques détaillées.';
    if (/conseil|améliorer|taux/.test(last)) return 'Appelez tôt le matin (8h-10h) : le taux de contact est généralement 30% plus élevé.';
    return 'Comment puis-je vous aider ? (rappels, qualité, statistiques)';
  }
}
