import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisStateService } from '../../redis/redis-state.service';

/**
 * AgentSessionCleanupService — tâches de maintenance planifiées
 *
 * Crons :
 *   Toutes les heures   → supprime les sessions inactives > 24h
 *   Toutes les 30 min   → nettoie les pending qualifications orphelines
 *   Toutes les 6 heures → synchronise le SET Redis available avec la DB
 */
@Injectable()
export class AgentSessionCleanupService {
  private readonly logger = new Logger(AgentSessionCleanupService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly redisState:  RedisStateService,
  ) {}

  // ── Sessions inactives > 24h ───────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupStaleSessions(): Promise<void> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1_000);

    const stale = await this.prisma.agentSession.findMany({
      where: { loginAt: { lt: cutoff } },
      select: { agentId: true, tenantId: true },
    });

    if (stale.length === 0) return;

    await Promise.all(
      stale.map((s) => Promise.all([
        this.redisState.deleteAgentState(s.agentId),
        this.redisState.markUnavailable(s.tenantId, s.agentId),
        this.redisState.clearPendingQualification(s.agentId),
      ])),
    );

    await this.prisma.agentSession.deleteMany({
      where: { loginAt: { lt: cutoff } },
    });

    this.logger.log(`[Cleanup] ${stale.length} session(s) inactives supprimées`);
  }

  // ── Pending qualifications orphelines ─────────────────────────────────────

  @Cron('0 */30 * * * *')  // toutes les 30 minutes
  async cleanupOrphanQualifications(): Promise<void> {
    // Qualifications dont le callLog n'existe plus en DB
    const sessions = await this.prisma.agentSession.findMany({
      where: { pendingQualificationCallLogId: { not: null } },
      select: { agentId: true, pendingQualificationCallLogId: true },
    });

    let cleared = 0;
    for (const s of sessions) {
      const callLogId = s.pendingQualificationCallLogId!;
      const exists = await this.prisma.callLog.findUnique({
        where: { id: callLogId },
        select: { id: true },
      });

      if (!exists) {
        await Promise.all([
          this.redisState.clearPendingQualification(s.agentId),
          this.prisma.agentSession.updateMany({
            where: { agentId: s.agentId },
            data:  { pendingQualificationCallLogId: null },
          }),
        ]);
        cleared++;
      }
    }

    if (cleared > 0) {
      this.logger.log(`[Cleanup] ${cleared} qualification(s) orpheline(s) nettoyées`);
    }
  }

  // ── Synchronisation SET Redis ↔ DB ────────────────────────────────────────

  @Cron('0 0 */6 * * *')  // toutes les 6 heures
  async syncRedisAvailableSets(): Promise<void> {
    const tenants = await this.prisma.agentSession.groupBy({
      by: ['tenantId'],
    });

    for (const { tenantId } of tenants) {
      const available = await this.prisma.agentSession.findMany({
        where: {
          tenantId,
          availability: 'AVAILABLE',
          pendingQualificationCallLogId: null,
        },
        select: { agentId: true },
      });

      const validIds = available.map((s) => s.agentId);
      await this.redisState.cleanupAgentAvailableSet(tenantId, validIds);
    }

    this.logger.debug(`[Cleanup] SET Redis synchronisé pour ${tenants.length} tenant(s)`);
  }
}
