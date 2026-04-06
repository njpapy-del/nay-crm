// ─── Ollama HTTP Client ───────────────────────────────────────────────────────
// Client dédié à l'IA analytique — indépendant du chatbot LlmService
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OllamaGenerateResponse {
  response:         string;
  model:            string;
  done:             boolean;
  total_duration?:  number;
  eval_count?:      number;
}

@Injectable()
export class OllamaClient {
  private readonly logger     = new Logger(OllamaClient.name);
  private readonly baseUrl:   string;
  private readonly model:     string;
  private readonly timeoutMs: number;

  constructor(private readonly cfg: ConfigService) {
    this.baseUrl   = cfg.get<string>('OLLAMA_URL',        'http://ollama:11434');
    this.model     = cfg.get<string>('OLLAMA_AI_MODEL',   'llama3');
    this.timeoutMs = cfg.get<number>('OLLAMA_TIMEOUT_MS', 120_000); // 2 min
  }

  // ── Génération de texte ───────────────────────────────────────────────────

  async generate(prompt: string, model?: string): Promise<{ text: string; ms: number }> {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    const start = Date.now();

    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          model:   model ?? this.model,
          prompt,
          stream:  false,
          options: { temperature: 0.3, top_p: 0.9, num_predict: 2048 },
        }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Ollama HTTP ${res.status}: ${body}`);
      }

      const data = (await res.json()) as OllamaGenerateResponse;
      const ms   = Date.now() - start;

      this.logger.debug(
        `Ollama [${data.model}] responded in ${ms}ms ` +
        `(eval_count=${data.eval_count ?? '?'})`,
      );

      return { text: data.response, ms };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Ollama timeout (>${this.timeoutMs}ms). Réduisez le texte ou augmentez OLLAMA_TIMEOUT_MS.`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Parse JSON depuis réponse Ollama (gère les blocs markdown) ────────────

  parseJson<T>(raw: string): T {
    const cleaned = raw
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      .trim();

    // Extraire le premier bloc JSON valide
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd   = cleaned.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error(`Réponse Ollama sans JSON valide: ${cleaned.slice(0, 200)}`);
    }

    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as T;
  }

  get currentModel(): string { return this.model; }
}
