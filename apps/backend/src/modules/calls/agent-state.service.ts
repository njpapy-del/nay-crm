import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentAvailability } from '@prisma/client';

export interface AgentStateSnapshot {
  agentId: string;
  tenantId: string;
  availability: AgentAvailability;
  extension: string;
  currentCallId: string | null;
  pauseReason: string | null;
  loginAt: Date;
  agent: { firstName: string; lastName: string; email: string };
}

/**
 * Gère la machine à états des agents
 * OFFLINE → AVAILABLE → RINGING → IN_CALL → WRAP_UP → AVAILABLE
 *                    ↘ PAUSED ↗
 */
@Injectable()
export class AgentStateService {
  private readonly logger = new Logger(AgentStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Login / Logout ────────────────────────────────────────

  async login(tenantId: string, agentId: string, extension: string): Promise<AgentStateSnapshot> {
    const session = await this.prisma.agentSession.upsert({
      where: { agentId },
      create: { tenantId, agentId, extension, availability: 'AVAILABLE', loginAt: new Date() },
      update: { availability: 'AVAILABLE', extension, loginAt: new Date(), currentCallId: null, pauseReason: null },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    this.events.emit('agent.state.changed', this.toSnapshot(session));
    this.logger.log(`Agent connecté: ${extension} (${agentId})`);
    return this.toSnapshot(session);
  }

  async logout(agentId: string) {
    const session = await this.prisma.agentSession.findUnique({ where: { agentId } });
    if (!session) return;
    await this.prisma.agentSession.delete({ where: { agentId } });
    this.events.emit('agent.state.changed', { agentId, availability: 'OFFLINE' });
    this.logger.log(`Agent déconnecté: ${agentId}`);
  }

  // ── Transitions d'état ────────────────────────────────────

  async setAvailable(agentId: string) {
    return this.transition(agentId, 'AVAILABLE', { currentCallId: null, pauseReason: null });
  }

  async setRinging(agentId: string, callId: string) {
    return this.transition(agentId, 'RINGING', { currentCallId: callId });
  }

  async setInCall(agentId: string, callId: string) {
    return this.transition(agentId, 'IN_CALL', { currentCallId: callId });
  }

  async setWrapUp(agentId: string) {
    return this.transition(agentId, 'WRAP_UP', { currentCallId: null });
  }

  async setPaused(agentId: string, reason?: string) {
    return this.transition(agentId, 'PAUSED', { pauseReason: reason ?? 'Manuel', currentCallId: null });
  }

  private async transition(agentId: string, availability: AgentAvailability, extra: Record<string, any> = {}) {
    const session = await this.prisma.agentSession.update({
      where: { agentId },
      data: { availability, ...extra },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    const snap = this.toSnapshot(session);
    this.events.emit('agent.state.changed', snap);
    return snap;
  }

  // ── Requêtes ──────────────────────────────────────────────

  async getAll(tenantId: string): Promise<AgentStateSnapshot[]> {
    const sessions = await this.prisma.agentSession.findMany({
      where: { tenantId },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { loginAt: 'asc' },
    });
    return sessions.map(this.toSnapshot);
  }

  async getAvailable(tenantId: string): Promise<AgentStateSnapshot[]> {
    const sessions = await this.prisma.agentSession.findMany({
      where: { tenantId, availability: 'AVAILABLE' },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    return sessions.map(this.toSnapshot);
  }

  async getByAgent(agentId: string): Promise<AgentStateSnapshot | null> {
    const session = await this.prisma.agentSession.findUnique({
      where: { agentId },
      include: { agent: { select: { firstName: true, lastName: true, email: true } } },
    });
    return session ? this.toSnapshot(session) : null;
  }

  // ── Stats supervision ─────────────────────────────────────

  async getStats(tenantId: string) {
    const sessions = await this.prisma.agentSession.groupBy({
      by: ['availability'],
      where: { tenantId },
      _count: true,
    });
    const counts = Object.fromEntries(sessions.map((s) => [s.availability, s._count]));
    return {
      total: sessions.reduce((a, s) => a + s._count, 0),
      available: counts['AVAILABLE'] ?? 0,
      inCall: counts['IN_CALL'] ?? 0,
      ringing: counts['RINGING'] ?? 0,
      wrapUp: counts['WRAP_UP'] ?? 0,
      paused: counts['PAUSED'] ?? 0,
    };
  }

  private toSnapshot = (session: any): AgentStateSnapshot => ({
    agentId: session.agentId,
    tenantId: session.tenantId,
    availability: session.availability,
    extension: session.extension,
    currentCallId: session.currentCallId,
    pauseReason: session.pauseReason,
    loginAt: session.loginAt,
    agent: session.agent,
  });
}
