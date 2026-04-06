import {
  Controller, Post, Get, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AiAnalyticsService } from './ai-analytics.service';
import {
  SummarizeCallDto,
  ScoreCallDto,
  SuggestScriptDto,
  AnalyzeAgentDto,
  GetAiHistoryDto,
} from './dto/ai-analytics.dto';

@Controller('ai-analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiAnalyticsController {
  constructor(private readonly svc: AiAnalyticsService) {}

  // ── Résumé d'appel ────────────────────────────────────────────────────────

  @Post('summarize')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  summarize(@CurrentUser() user: any, @Body() dto: SummarizeCallDto) {
    return this.svc.summarizeCall(user.tenantId, user.sub, dto);
  }

  // ── Scoring qualité ───────────────────────────────────────────────────────

  @Post('score')
  @Roles('ADMIN', 'MANAGER', 'QUALITY')
  score(@CurrentUser() user: any, @Body() dto: ScoreCallDto) {
    return this.svc.scoreCall(user.tenantId, user.sub, dto);
  }

  // ── Suggestions script ────────────────────────────────────────────────────

  @Post('suggest')
  @Roles('ADMIN', 'MANAGER')
  suggest(@CurrentUser() user: any, @Body() dto: SuggestScriptDto) {
    return this.svc.suggestScript(user.tenantId, user.sub, dto);
  }

  // ── Analyse performance agent ─────────────────────────────────────────────

  @Post('performance')
  @Roles('ADMIN', 'MANAGER')
  performance(@CurrentUser() user: any, @Body() dto: AnalyzeAgentDto) {
    return this.svc.analyzeAgent(user.tenantId, user.sub, dto);
  }

  // ── Récupérer un résultat (polling) ───────────────────────────────────────

  @Get('result/:jobId')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  getResult(@CurrentUser() user: any, @Param('jobId') jobId: string) {
    return this.svc.getJob(user.tenantId, jobId);
  }

  // ── Historique des analyses ───────────────────────────────────────────────

  @Get('history')
  @Roles('ADMIN', 'MANAGER', 'QUALITY')
  history(@CurrentUser() user: any, @Query() dto: GetAiHistoryDto) {
    return this.svc.getHistory(user.tenantId, dto);
  }

  // ── Quota restant ─────────────────────────────────────────────────────────

  @Get('quota')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  quota(@CurrentUser() user: any) {
    return this.svc.getQuota(user.tenantId);
  }
}
