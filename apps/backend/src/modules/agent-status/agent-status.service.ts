import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AgentStatusType } from '@prisma/client';

// Minutes before an alert is raised per status type
const ALERT_LIMITS_MIN: Partial<Record<AgentStatusType, number>> = {
  LUNCH_BREAK:  60,
  COFFEE_BREAK: 15,
  DEBRIEF:      20,
};

const AGENT_SELECT = { id: true, firstName: true, lastName: true };

@Injectable()
export class AgentStatusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Status change ──────────────────────────────────────────────

  async changeStatus(tenantId: string, agentId: string, status: AgentStatusType, notes?: string) {
    await this._closeCurrentLog(agentId);

    const log = await this.prisma.agentStatusLog.create({
      data: { tenantId, agentId, status, notes },
      include: { agent: { select: AGENT_SELECT } },
    });

    this.events.emit('agent.status.changed', { tenantId, agentId, status, log });
    return log;
  }

  // ── Queries ────────────────────────────────────────────────────

  async getCurrent(agentId: string) {
    const log = await this.prisma.agentStatusLog.findFirst({
      where: { agentId, endedAt: null },
      include: { agent: { select: AGENT_SELECT } },
      orderBy: { startedAt: 'desc' },
    });
    if (!log) return null;
    const durationSec = Math.floor((Date.now() - log.startedAt.getTime()) / 1000);
    return { ...log, durationSec };
  }

  async getHistory(tenantId: string, agentId: string, from?: Date, to?: Date) {
    const where: any = { tenantId, agentId };
    if (from || to) {
      where.startedAt = {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to  } : {}),
      };
    }
    return this.prisma.agentStatusLog.findMany({
      where,
      include: { agent: { select: AGENT_SELECT } },
      orderBy: { startedAt: 'desc' },
      take: 500,
    });
  }

  async getTimeBreakdown(tenantId: string, agentId: string, from: Date, to: Date) {
    const logs = await this.prisma.agentStatusLog.findMany({
      where: { tenantId, agentId, startedAt: { gte: from, lte: to } },
    });

    const sec: Record<string, number> = {
      AVAILABLE: 0, IN_CALL: 0, DEBRIEF: 0,
      LUNCH_BREAK: 0, COFFEE_BREAK: 0, TRAINING: 0, OFFLINE: 0,
    };

    for (const log of logs) {
      const end = log.endedAt ?? new Date();
      const dur = Math.floor((end.getTime() - log.startedAt.getTime()) / 1000);
      if (log.status in sec) sec[log.status] += dur;
    }

    return {
      ...sec,
      production: sec.AVAILABLE + sec.IN_CALL + sec.DEBRIEF,
      pause:      sec.LUNCH_BREAK + sec.COFFEE_BREAK,
      training:   sec.TRAINING,
    };
  }

  async getTeamSnapshot(tenantId: string) {
    const openLogs = await this.prisma.agentStatusLog.findMany({
      where: { tenantId, endedAt: null },
      include: { agent: { select: AGENT_SELECT } },
      orderBy: { startedAt: 'asc' },
    });

    const now = Date.now();
    return openLogs.map((log) => {
      const durationSec = Math.floor((now - log.startedAt.getTime()) / 1000);
      const limitMin    = ALERT_LIMITS_MIN[log.status];
      const alert       = limitMin ? durationSec > limitMin * 60 : false;
      return { ...log, durationSec, alert };
    });
  }

  async getTeamBreakdownToday(tenantId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const agents = await this.prisma.user.findMany({
      where: { tenantId, role: 'AGENT', isActive: true },
      select: { ...AGENT_SELECT },
    });

    const results = await Promise.all(
      agents.map(async (agent) => {
        const breakdown = await this.getTimeBreakdown(tenantId, agent.id, today, new Date());
        return { agent, ...breakdown };
      }),
    );
    return results;
  }

  // ── Private ────────────────────────────────────────────────────

  private async _closeCurrentLog(agentId: string) {
    const current = await this.prisma.agentStatusLog.findFirst({
      where: { agentId, endedAt: null },
      orderBy: { startedAt: 'desc' },
    });
    if (!current) return;
    const now = new Date();
    const durationSec = Math.floor((now.getTime() - current.startedAt.getTime()) / 1000);
    await this.prisma.agentStatusLog.update({
      where: { id: current.id },
      data: { endedAt: now, durationSec },
    });
  }
}
