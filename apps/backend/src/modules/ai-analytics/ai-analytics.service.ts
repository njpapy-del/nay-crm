// ─── AI Analytics Service ─────────────────────────────────────────────────────
// ⚠️  Module SÉPARÉ du chatbot (chatbot/) — pas d'import croisé
// ─────────────────────────────────────────────────────────────────────────────

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { AiQuotaService } from './ai-quota.service';
import {
  QUEUE_AI_SUMMARY,
  QUEUE_AI_SCORING,
  QUEUE_AI_SUGGESTIONS,
  QUEUE_AI_PERFORMANCE,
  JOB_SUMMARIZE,
  JOB_SCORE,
  JOB_SUGGEST,
  JOB_PERFORMANCE,
  AI_JOB_OPTS,
  AiJobPayload,
} from '../queue/queue.constants';
import {
  SummarizeCallDto,
  ScoreCallDto,
  SuggestScriptDto,
  AnalyzeAgentDto,
  GetAiHistoryDto,
} from './dto/ai-analytics.dto';
import { AiJobType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiAnalyticsService {
  private readonly logger = new Logger(AiAnalyticsService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly quota:     AiQuotaService,
    @InjectQueue(QUEUE_AI_SUMMARY)     private readonly qSummary:     Queue,
    @InjectQueue(QUEUE_AI_SCORING)     private readonly qScoring:     Queue,
    @InjectQueue(QUEUE_AI_SUGGESTIONS) private readonly qSuggestions: Queue,
    @InjectQueue(QUEUE_AI_PERFORMANCE) private readonly qPerformance: Queue,
  ) {}

  // ── Résumé d'appel ────────────────────────────────────────────────────────

  async summarizeCall(tenantId: string, userId: string, dto: SummarizeCallDto) {
    await this.quota.checkAndConsume(tenantId);

    const job = await this.prisma.aiJob.create({
      data: {
        tenantId,
        userId,
        type:  AiJobType.SUMMARY,
        input: { transcription: dto.transcription, callId: dto.callId ?? null },
      },
    });

    const payload: AiJobPayload = { jobId: job.id, tenantId, userId };
    await this.qSummary.add(JOB_SUMMARIZE, payload, AI_JOB_OPTS);

    this.logger.log(`[SUMMARY] job ${job.id} queued for tenant ${tenantId}`);
    return { jobId: job.id, status: job.status };
  }

  // ── Scoring qualité ───────────────────────────────────────────────────────

  async scoreCall(tenantId: string, userId: string, dto: ScoreCallDto) {
    await this.quota.checkAndConsume(tenantId);

    const job = await this.prisma.aiJob.create({
      data: {
        tenantId,
        userId,
        type:  AiJobType.SCORING,
        input: { transcription: dto.transcription, callId: dto.callId ?? null },
      },
    });

    const payload: AiJobPayload = { jobId: job.id, tenantId, userId };
    await this.qScoring.add(JOB_SCORE, payload, AI_JOB_OPTS);

    this.logger.log(`[SCORING] job ${job.id} queued for tenant ${tenantId}`);
    return { jobId: job.id, status: job.status };
  }

  // ── Suggestions script ────────────────────────────────────────────────────

  async suggestScript(tenantId: string, userId: string, dto: SuggestScriptDto) {
    await this.quota.checkAndConsume(tenantId);

    const job = await this.prisma.aiJob.create({
      data: {
        tenantId,
        userId,
        type:  AiJobType.SUGGESTIONS,
        input: { content: dto.content, campaignId: dto.campaignId ?? null },
      },
    });

    const payload: AiJobPayload = { jobId: job.id, tenantId, userId };
    await this.qSuggestions.add(JOB_SUGGEST, payload, AI_JOB_OPTS);

    this.logger.log(`[SUGGESTIONS] job ${job.id} queued for tenant ${tenantId}`);
    return { jobId: job.id, status: job.status };
  }

  // ── Analyse performance agent ─────────────────────────────────────────────

  async analyzeAgent(tenantId: string, userId: string, dto: AnalyzeAgentDto) {
    await this.quota.checkAndConsume(tenantId);

    const stats = await this._collectAgentStats(tenantId, dto.agentId, dto.periodDays ?? 30);

    const job = await this.prisma.aiJob.create({
      data: {
        tenantId,
        userId,
        type:  AiJobType.PERFORMANCE,
        input: { agentId: dto.agentId, periodDays: dto.periodDays ?? 30, stats },
      },
    });

    const payload: AiJobPayload = { jobId: job.id, tenantId, userId };
    await this.qPerformance.add(JOB_PERFORMANCE, payload, AI_JOB_OPTS);

    this.logger.log(`[PERFORMANCE] job ${job.id} queued for agent ${dto.agentId}`);
    return { jobId: job.id, status: job.status };
  }

  // ── Récupérer un résultat ─────────────────────────────────────────────────

  async getJob(tenantId: string, jobId: string) {
    const job = await this.prisma.aiJob.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) throw new NotFoundException('Analyse introuvable');
    return job;
  }

  // ── Historique des analyses ───────────────────────────────────────────────

  async getHistory(tenantId: string, dto: GetAiHistoryDto) {
    return this.prisma.aiJob.findMany({
      where: {
        tenantId,
        ...(dto.type ? { type: dto.type as AiJobType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take:    dto.limit ?? 20,
      select: {
        id: true, type: true, status: true, result: true,
        error: true, processingMs: true, createdAt: true,
        input: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
  }

  // ── Quota restant ─────────────────────────────────────────────────────────

  async getQuota(tenantId: string) {
    return this.quota.getUsage(tenantId);
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private async _collectAgentStats(tenantId: string, agentId: string, periodDays: number) {
    const from = new Date();
    from.setDate(from.getDate() - periodDays);

    const [agent, logs] = await Promise.all([
      this.prisma.user.findFirst({
        where: { id: agentId, tenantId },
        select: { firstName: true, lastName: true, createdAt: true },
      }),
      this.prisma.callLog.findMany({
        where: { tenantId, agentId, createdAt: { gte: from } },
        select: { qualification: true, createdAt: true },
        take: 500,
      }),
    ]);

    const total = logs.length;
    const breakdown: Record<string, number> = {};
    for (const log of logs) {
      const q = log.qualification ?? 'NON_QUALIFIE';
      breakdown[q] = (breakdown[q] ?? 0) + 1;
    }

    const sales        = breakdown['SALE']        ?? 0;
    const appointments = breakdown['APPOINTMENT'] ?? 0;
    const callbacks    = breakdown['CALLBACK']    ?? 0;
    const dnc          = breakdown['DNC']         ?? 0;

    return {
      agentName:       agent ? `${agent.firstName} ${agent.lastName}` : agentId,
      periodDays,
      totalCalls:      total,
      salesCount:      sales,
      appointmentCount: appointments,
      callbackCount:   callbacks,
      dncCount:        dnc,
      conversionRate:  total > 0 ? Math.round((sales / total) * 100) : 0,
      qualificationBreakdown: breakdown,
    };
  }
}
