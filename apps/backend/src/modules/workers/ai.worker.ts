// ─── AI Worker — Processeurs BullMQ ──────────────────────────────────────────
// ⚠️  Aucun import depuis chatbot/ — module analytique indépendant
// ─────────────────────────────────────────────────────────────────────────────

import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { createHash } from 'crypto';
import type Redis from 'ioredis';

import { PrismaService } from '../../prisma/prisma.service';
import { OllamaClient } from './ollama.client';
import { PROMPTS } from '../ai-analytics/prompts/ai.prompts';
import { REDIS_CLIENT } from '../../redis/redis.module';
import {
  QUEUE_AI_SUMMARY,
  QUEUE_AI_SCORING,
  QUEUE_AI_SUGGESTIONS,
  QUEUE_AI_PERFORMANCE,
  AiJobPayload,
} from '../queue/queue.constants';
import { AiJobStatus } from '@prisma/client';

const CACHE_TTL_SEC = 3600 * 24 * 7; // 7 jours

// ─── Base partagée ────────────────────────────────────────────────────────────

@Injectable()
export class AiWorkerBase {
  protected readonly logger = new Logger(AiWorkerBase.name);

  constructor(
    protected readonly prisma:  PrismaService,
    protected readonly ollama:  OllamaClient,
    @Inject(REDIS_CLIENT) protected readonly redis: Redis,
  ) {}

  // ── Traitement générique d'un job ─────────────────────────────────────────

  async run(
    jobId:      string,
    promptFn:   (input: any) => string,
    inputKey:   string,
  ): Promise<void> {
    // 1. Marquer PROCESSING
    await this.prisma.aiJob.update({
      where: { id: jobId },
      data:  { status: AiJobStatus.PROCESSING },
    });

    const dbJob = await this.prisma.aiJob.findUniqueOrThrow({ where: { id: jobId } });
    const input = dbJob.input as Record<string, any>;

    // 2. Clé de cache basée sur le contenu
    const textForHash = String(input[inputKey] ?? JSON.stringify(input));
    const cacheKey    = `ai:${dbJob.type}:${createHash('sha256').update(textForHash).digest('hex').slice(0, 16)}`;

    try {
      // 3. Cache hit?
      const cached = await this.redis.get(cacheKey).catch(() => null);
      if (cached) {
        this.logger.debug(`Cache hit for job ${jobId} [${dbJob.type}]`);
        await this.prisma.aiJob.update({
          where: { id: jobId },
          data: {
            status:      AiJobStatus.COMPLETED,
            result:      JSON.parse(cached),
            processingMs: 0,
          },
        });
        return;
      }

      // 4. Appel Ollama
      const prompt = promptFn(input);
      const { text, ms } = await this.ollama.generate(prompt);

      // 5. Parse JSON
      const result = this.ollama.parseJson(text);

      // 6. Sauvegarder en DB
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status:       AiJobStatus.COMPLETED,
          result:       result as any,
          model:        this.ollama.currentModel,
          processingMs: ms,
        },
      });

      // 7. Mettre en cache
      await this.redis.set(cacheKey, JSON.stringify(result), 'EX', CACHE_TTL_SEC).catch(() => null);

      this.logger.log(`Job ${jobId} [${dbJob.type}] completed in ${ms}ms`);
    } catch (err: any) {
      this.logger.error(`Job ${jobId} failed: ${err.message}`);
      await this.prisma.aiJob.update({
        where: { id: jobId },
        data: {
          status: AiJobStatus.FAILED,
          error:  err.message?.slice(0, 1000) ?? 'Erreur inconnue',
        },
      });
      throw err; // BullMQ gère le retry
    }
  }
}

// ─── Processor : Résumé ───────────────────────────────────────────────────────

@Processor(QUEUE_AI_SUMMARY, { concurrency: 2 })
export class AiSummaryProcessor extends WorkerHost {
  constructor(private readonly base: AiWorkerBase) { super(); }

  async process(job: Job<AiJobPayload>): Promise<void> {
    await this.base.run(
      job.data.jobId,
      (input) => PROMPTS.summary(input.transcription ?? ''),
      'transcription',
    );
  }
}

// ─── Processor : Scoring ──────────────────────────────────────────────────────

@Processor(QUEUE_AI_SCORING, { concurrency: 2 })
export class AiScoringProcessor extends WorkerHost {
  constructor(private readonly base: AiWorkerBase) { super(); }

  async process(job: Job<AiJobPayload>): Promise<void> {
    await this.base.run(
      job.data.jobId,
      (input) => PROMPTS.scoring(input.transcription ?? ''),
      'transcription',
    );
  }
}

// ─── Processor : Suggestions ──────────────────────────────────────────────────

@Processor(QUEUE_AI_SUGGESTIONS, { concurrency: 2 })
export class AiSuggestionsProcessor extends WorkerHost {
  constructor(private readonly base: AiWorkerBase) { super(); }

  async process(job: Job<AiJobPayload>): Promise<void> {
    await this.base.run(
      job.data.jobId,
      (input) => PROMPTS.suggestions(input.content ?? ''),
      'content',
    );
  }
}

// ─── Processor : Performance ──────────────────────────────────────────────────

@Processor(QUEUE_AI_PERFORMANCE, { concurrency: 1 })
export class AiPerformanceProcessor extends WorkerHost {
  constructor(private readonly base: AiWorkerBase) { super(); }

  async process(job: Job<AiJobPayload>): Promise<void> {
    await this.base.run(
      job.data.jobId,
      (input) => PROMPTS.performance(JSON.stringify(input.stats ?? input, null, 2)),
      'stats',
    );
  }
}
