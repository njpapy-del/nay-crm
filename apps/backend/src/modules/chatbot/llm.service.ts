import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const TIMEOUT_GROQ_MS   =  8_000;  // 8s — réduit de 35s
const TIMEOUT_OLLAMA_MS = 25_000;  // 25s — réponse complète locale

@Injectable()
export class LlmService implements OnModuleInit {
  private readonly logger = new Logger(LlmService.name);

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const url   = this.config.get<string>('OLLAMA_URL')   ?? 'http://localhost:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'gemma3:1b';
    this.logger.log(`Pre-warming Ollama model ${model}…`);
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60_000);
      const res = await fetch(`${url}/api/chat`, {
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

  // ── Réponse complète (HTTP) ───────────────────────────────────────────────

  async chat(messages: LlmMessage[]): Promise<string> {
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      try { return await this._groqComplete(messages, groqKey); }
      catch (e: any) { this.logger.warn(`Groq: ${e.message} — fallback Ollama`); }
    }
    try { return await this._ollamaComplete(messages); }
    catch (e: any) { this.logger.warn(`Ollama: ${e.message} — fallback rule-based`); }
    return this._ruleBased(messages);
  }

  // ── Streaming de tokens (WebSocket) ──────────────────────────────────────
  // onToken est appelé pour chaque fragment de texte reçu
  // Retourne le texte complet pour la sauvegarde en DB

  async streamChat(
    messages: LlmMessage[],
    onToken: (token: string) => void,
  ): Promise<string> {
    const groqKey = this.config.get<string>('GROQ_API_KEY');
    if (groqKey) {
      try { return await this._groqStream(messages, groqKey, onToken); }
      catch (e: any) { this.logger.warn(`Groq stream: ${e.message} — fallback Ollama`); }
    }
    try { return await this._ollamaStream(messages, onToken); }
    catch (e: any) { this.logger.warn(`Ollama stream: ${e.message} — fallback complete`); }

    // Dernier recours : réponse complète rule-based émise d'un coup
    const reply = this._ruleBased(messages);
    onToken(reply);
    return reply;
  }

  // ── Groq — complet ────────────────────────────────────────────────────────

  private async _groqComplete(messages: LlmMessage[], apiKey: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_GROQ_MS);
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

  // ── Groq — streaming SSE ──────────────────────────────────────────────────

  private async _groqStream(
    messages: LlmMessage[],
    apiKey: string,
    onToken: (t: string) => void,
  ): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_GROQ_MS);
    let full = '';
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'llama3-8b-8192', messages, max_tokens: 200, temperature: 0.4, stream: true }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
          const data = line.replace(/^data: /, '').trim();
          if (!data || data === '[DONE]') continue;
          try {
            const token = JSON.parse(data).choices?.[0]?.delta?.content ?? '';
            if (token) { full += token; onToken(token); }
          } catch {}
        }
      }
      return full;
    } finally { clearTimeout(t); }
  }

  // ── Ollama — complet ──────────────────────────────────────────────────────

  private async _ollamaComplete(messages: LlmMessage[]): Promise<string> {
    const url   = this.config.get<string>('OLLAMA_URL')   ?? 'http://localhost:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'gemma3:1b';
    const ctrl  = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_OLLAMA_MS);
    try {
      const res = await fetch(`${url}/api/chat`, {
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

  // ── Ollama — streaming NDJSON ─────────────────────────────────────────────

  private async _ollamaStream(
    messages: LlmMessage[],
    onToken: (t: string) => void,
  ): Promise<string> {
    const url   = this.config.get<string>('OLLAMA_URL')   ?? 'http://localhost:11434';
    const model = this.config.get<string>('OLLAMA_MODEL') ?? 'gemma3:1b';
    const ctrl  = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_OLLAMA_MS);
    let full = '';
    try {
      const res = await fetch(`${url}/api/chat`, {
        method: 'POST', signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages, stream: true,
          options: { temperature: 0.4, num_predict: 150, num_ctx: 1024 },
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const obj = JSON.parse(line);
            const token = obj.message?.content ?? '';
            if (token) { full += token; onToken(token); }
          } catch {}
        }
      }
      return full;
    } finally { clearTimeout(t); }
  }

  // ── Rule-based fallback ───────────────────────────────────────────────────

  private _ruleBased(messages: LlmMessage[]): string {
    const last = messages.at(-1)?.content?.toLowerCase() ?? '';
    if (/rappel|reminder/.test(last))  return 'Consultez le panneau Rappels pour voir vos rappels en attente.';
    if (/qualit|alerte/.test(last))    return 'Aucune alerte qualité critique détectée pour le moment.';
    if (/bonjour|salut|hello|hi/.test(last)) return 'Bonjour ! Je suis votre assistant LNAYCRM. Comment puis-je vous aider ?';
    if (/aide|help/.test(last))        return 'Je peux vous aider avec vos rappels, les alertes qualité et les statistiques.';
    if (/stat|kpi|chiffre/.test(last)) return 'Consultez le tableau de bord pour vos statistiques détaillées.';
    if (/conseil|améliorer|taux/.test(last)) return 'Appelez tôt le matin (8h-10h) : le taux de contact est généralement 30% plus élevé.';
    return 'Comment puis-je vous aider ? (rappels, qualité, statistiques)';
  }
}
