import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisStateService } from '../../redis/redis-state.service';
import { AgentAvailability } from '@prisma/client';

export interface AgentStateSnapshot {
  agentId:                       string;
  tenantId:                      string;
  availability:                  AgentAvailability;
  extension:                     string;
  currentCallId:                 string | null;
  campaignId:                    string | null;
  pauseReason:                   string | null;
  pendingQualificationCallLogId: string | null;
  loginAt:                       Date;
  agent:                         { firstName: string; lastName: string; email: string };
}

/**
 * AgentStateService — machine à états agents (Hybrid Redis + Prisma)
 *
 * Stratégie :
 *   LECTURES  → Redis (O(1), <1ms) — pas de hit DB pour getAvailable() toutes les 5s
 *   ÉCRITURES → Redis immédiat + Prisma async (non-bloquant)
 *
 * Flux qualification post-appel :
 *   dialer.call.ended → setPendingQualification() → Redis + DB
 *   call.qualified    → onCallQualified()          → clear Redis + DB
 *   setAvailable()    → vérifie Redis avant d'autoriser
 */
@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);

  constructor(
    private readonly prisma:      PrismaService,
    private readonly events:      EventEmitter2,
    private readonly redisState:  RedisStateService,
  ) {}

  // ── Qualification post-appel (Redis primary, Prisma backup) ──────────────

  async setPendingQualification(agentId: string, callLogId: string): Promise<void> {
    // 1. Redis (lecture rapide dans setAvailable / getAvailable)
    await this.redisState.setPendingQualification(agentId, callLogId);

    // 2. Retirer de la liste des disponibles
    const session = await this.prisma.agentSession.findUnique({
      where: { agentId }, select: { tenantId: true },
    });
    if (session) await this.redisState.markUnavailable(session.tenantId, agentId);

    // 3. Prisma async (persistance inter-redémarrage)
    this.prisma.agentSession.updateMany({
      where: { agentId },
      data:  { pendingQualificationCallLogId: callLogId },
    }).catch((err) => this.logger.error(`[PendingQual] Prisma write error: ${err.message}`));

    this.logger.debug(`[PendingQual] SET agent=${agentId} callLog=${callLogId}`);
  }

  async getPendingQualification(agentId: string): Promise<string | null> {
    // Redis first
    const cached = await this.redisState.getPendingQualification(agentId);
    if (cached !== null) return cached;

    // Fallback DB (après restart ou expiration TTL)
    const session = await this.prisma.agentSession.findUnique({
      where: { agentId }, select: { pendingQualificationCallLogId: true },
    });
    const callLogId = session?.pendingQualificationCallLogId ?? null;

    // Reconstruire le cache Redis si la valeur existe en DB
    if (callLogId) await this.redisState.setPendingQualification(agentId, callLogId);

    return callLogId;
  }

  @OnEvent('call.qualified')
  async onCallQualified(data: { agentId: string; callLogId: string }): Promise<void> {
    const current = await this.getPendingQualification(data.agentId);
    if (current !== data.callLogId) return;

    // 1. Redis
    await this.redisState.clearPendingQualification(data.agentId);

    // 2. Prisma async
    this.prisma.agentSession.updateMany({
      where: { agentId: data.agentId },
      data:  { pendingQualificationCallLogId: null },
    }).catch((err) => this.logger.error(`[PendingQual] Prisma clear error: ${err.message}`));

    this.logger.debug(`[PendingQual] CLEAR agent=${data.agentId}`);
  }

  // ── Login / Logout ────────────────────────────────────────────────────────

  async login(tenantId: string, agentId: string, extension: string, campaignId?: string): Promise<AgentStateSnapshot> {
    const session = await this.prisma.agentSession.upsert({
      where:  { agentId },
      create: {
        tenantId, agentId, extension,
        campaignId: campaignId ?? null,
        availability: 'AVAILABLE',
        loginAt: new Date(),
        pendingQualificationCallLogId: null,
      },
      update: {
        availability: 'AVAILABLE',
        extension,
        campaignId: campaignId ?? null,
        loginAt: new Date(),
        currentCallId: null,
        pauseReason: null,
        pendingQualificationCallLogId: null,
      },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });

    const snap = this.toSnapshot(session);

    // Mettre à jour Redis
    await Promise.all([
      this.redisState.setAgentState(agentId, snap),
      this.redisState.markAvailable(tenantId, agentId),
      this.redisState.clearPendingQualification(agentId),
    ]);

    this.events.emit('agent.state.changed', snap);
    this.logger.log(`Agent connecté: ${extension} (${agentId})`);
    return snap;
  }

  async logout(agentId: string): Promise<void> {
    const session = await this.prisma.agentSession.findUnique({
      where: { agentId }, select: { tenantId: true },
    });
    if (!session) return;

    await this.prisma.agentSession.delete({ where: { agentId } });

    // Nettoyer Redis
    await Promise.all([
      this.redisState.deleteAgentState(agentId),
      this.redisState.markUnavailable(session.tenantId, agentId),
      this.redisState.clearPendingQualification(agentId),
    ]);

    this.events.emit('agent.state.changed', { agentId, availability: 'OFFLINE' });
    this.logger.log(`Agent déconnecté: ${agentId}`);
  }

  // ── Transitions d'état ────────────────────────────────────────────────────

  async setAvailable(agentId: string): Promise<AgentStateSnapshot> {
    // Vérifier qualification en attente (Redis, O(1))
    const pending = await this.redisState.getPendingQualification(agentId);
    if (pending) {
      throw new ForbiddenException('Qualification post-appel requise avant de passer en disponible');
    }
    return this.transition(agentId, 'AVAILABLE', { currentCallId: null, pauseReason: null }, true);
  }

  async setRinging(agentId: string, callId: string): Promise<AgentStateSnapshot> {
    return this.transition(agentId, 'RINGING', { currentCallId: callId }, false);
  }

  async setInCall(agentId: string, callId: string): Promise<AgentStateSnapshot> {
    return this.transition(agentId, 'IN_CALL', { currentCallId: callId }, false);
  }

  async setWrapUp(agentId: string): Promise<AgentStateSnapshot> {
    return this.transition(agentId, 'WRAP_UP', { currentCallId: null }, false);
  }

  async setPaused(agentId: string, reason?: string): Promise<AgentStateSnapshot> {
    return this.transition(agentId, 'PAUSED', { pauseReason: reason ?? 'Manuel', currentCallId: null }, false);
  }

  async setCampaign(agentId: string, campaignId: string | null): Promise<AgentStateSnapshot> {
    const session = await this.prisma.agentSession.update({
      where:   { agentId },
      data:    { campaignId },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    const snap = this.toSnapshot(session);
    await this.redisState.setAgentState(agentId, snap);
    this.events.emit('agent.state.changed', snap);
    return snap;
  }

  // ── Transition interne ────────────────────────────────────────────────────

  private async transition(
    agentId: string,
    availability: AgentAvailability,
    extra: Record<string, any> = {},
    available: boolean = false,
  ): Promise<AgentStateSnapshot> {
    const session = await this.prisma.agentSession.update({
      where:   { agentId },
      data:    { availability, ...extra },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    const snap = this.toSnapshot(session);

    // Mise à jour Redis
    await this.redisState.setAgentState(agentId, snap);

    if (available) {
      await this.redisState.markAvailable(session.tenantId, agentId);
    } else {
      await this.redisState.markUnavailable(session.tenantId, agentId);
    }

    this.events.emit('agent.state.changed', snap);
    return snap;
  }

  // ── Requêtes ──────────────────────────────────────────────────────────────

  /**
   * getAvailable — lecture depuis Redis (O(n) sur le SET, n = agents connectés)
   * Fallback Prisma si le SET Redis est vide (après restart).
   */
  async getAvailable(tenantId: string): Promise<AgentStateSnapshot[]> {
    const agentIds = await this.redisState.getAvailableAgentIds(tenantId);

    if (agentIds.length > 0) {
      // Lire les snapshots depuis Redis (pipeline pour minimiser round-trips)
      const snapshots = await Promise.all(
        agentIds.map((id) => this.redisState.getAgentState(id)),
      );
      const valid = snapshots.filter(Boolean) as AgentStateSnapshot[];
      if (valid.length > 0) return valid;
    }

    // Fallback DB (Redis vide = restart ou premier démarrage)
    this.logger.debug(`[AgentState] getAvailable fallback DB pour tenant=${tenantId}`);
    const sessions = await this.prisma.agentSession.findMany({
      where: {
        tenantId,
        availability: 'AVAILABLE',
        pendingQualificationCallLogId: null,
      },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });

    // Reconstruire le SET Redis
    await Promise.all(
      sessions.map((s) => Promise.all([
        this.redisState.setAgentState(s.agentId, this.toSnapshot(s)),
        this.redisState.markAvailable(tenantId, s.agentId),
      ])),
    );

    return sessions.map(this.toSnapshot);
  }

  async getAll(tenantId: string): Promise<AgentStateSnapshot[]> {
    const sessions = await this.prisma.agentSession.findMany({
      where:   { tenantId },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { loginAt: 'asc' },
    });
    return sessions.map(this.toSnapshot);
  }

  async getByAgent(agentId: string): Promise<AgentStateSnapshot | null> {
    // Redis first
    const cached = await this.redisState.getAgentState(agentId);
    if (cached) return cached as AgentStateSnapshot;

    // Fallback DB
    const session = await this.prisma.agentSession.findUnique({
      where:   { agentId },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    if (!session) return null;
    const snap = this.toSnapshot(session);
    await this.redisState.setAgentState(agentId, snap);
    return snap;
  }

  // ── Rate limiting WS ──────────────────────────────────────────────────────

  async checkRateLimit(agentId: string): Promise<boolean> {
    return this.redisState.checkRateLimit(agentId);
  }

  // ── Stats supervision ─────────────────────────────────────────────────────

  async getStats(tenantId: string) {
    const sessions = await this.prisma.agentSession.groupBy({
      by:    ['availability'],
      where: { tenantId },
      _count: true,
    });
    const counts = Object.fromEntries(sessions.map((s) => [s.availability, s._count]));
    return {
      total:     sessions.reduce((a, s) => a + s._count, 0),
      available: counts['AVAILABLE'] ?? 0,
      inCall:    counts['IN_CALL']   ?? 0,
      ringing:   counts['RINGING']   ?? 0,
      wrapUp:    counts['WRAP_UP']   ?? 0,
      paused:    counts['PAUSED']    ?? 0,
    };
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  private toSnapshot = (session: any): AgentStateSnapshot => ({
    agentId:                       session.agentId,
    tenantId:                      session.tenantId,
    availability:                  session.availability,
    extension:                     session.extension,
    currentCallId:                 session.currentCallId,
    campaignId:                    session.campaignId ?? null,
    pauseReason:                   session.pauseReason,
    pendingQualificationCallLogId: session.pendingQualificationCallLogId ?? null,
    loginAt:                       session.loginAt,
    agent:                         session.agent,
  });
}
