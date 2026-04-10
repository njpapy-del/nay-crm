import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentStateService } from '../calls/agent-state.service';
import { DialerService } from '../calls/dialer.service';
import { SupervisionService } from '../supervision/supervision.service';

export interface RealtimeSnapshot {
  tenantId: string;
  agents: RealtimeAgent[];
  activeCalls: RealtimeCall[];
  queues: RealtimeQueue[];
  dialer: RealtimeDialer[];
  kpis: RealtimeKpis;
  spySessions: SpyInfo[];
  timestamp: string;
}

export interface RealtimeAgent {
  agentId: string;
  name: string;
  extension: string;
  availability: string;
  currentCallId: string | null;
  callsToday: number;
  avgDurationToday: number;
  pauseReason: string | null;
}

interface RealtimeCall {
  id: string;
  agentId: string | null;
  agentName: string;
  callerNumber: string;
  calleeNumber: string;
  direction: string;
  status: string;
  duration: number;
  startedAt: string;
}

interface RealtimeQueue {
  name: string;
  waiting: number;
  agentsAvailable: number;
}

interface RealtimeDialer {
  campaignId: string;
  mode: string;
  active: boolean;
}

interface RealtimeKpis {
  totalCallsToday: number;
  answeredToday: number;
  answerRate: number;
  avgDuration: number;
  salesToday: number;
  activeCallsNow: number;
  agentsOnline: number;
  agentsAvailable: number;
  agentsInCall: number;
}

interface SpyInfo {
  supervisorId: string;
  supervisorExtension: string;
  targetExtension: string;
  mode: string;
}

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private cache = new Map<string, RealtimeSnapshot>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentState: AgentStateService,
    private readonly dialer: DialerService,
    private readonly supervision: SupervisionService,
  ) {}

  async getSnapshot(tenantId: string): Promise<RealtimeSnapshot> {
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [agentSessions, activeCalls, kpisRaw, agentCallStats] = await Promise.all([
      this.agentState.getAll(tenantId),
      this.prisma.call.findMany({
        where: { tenantId, status: { in: ['RINGING', 'ANSWERED'] } },
        select: {
          id: true, agentId: true, callerNumber: true, calleeNumber: true,
          direction: true, status: true, startedAt: true, answeredAt: true,
          agent: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.call.aggregate({
        where: { tenantId, startedAt: { gte: today } },
        _count: true,
        _avg: { duration: true },
      }),
      this.getAgentCallStats(tenantId, today),
    ]);

    const answered = await this.prisma.call.count({ where: { tenantId, status: 'ANSWERED', startedAt: { gte: today } } });
    const sales    = await this.prisma.call.count({ where: { tenantId, disposition: 'SALE', startedAt: { gte: today } } });

    const agents: RealtimeAgent[] = agentSessions.map((s) => ({
      agentId: s.agentId,
      name: `${s.agent.firstName} ${s.agent.lastName}`,
      extension: s.extension,
      availability: s.availability,
      currentCallId: s.currentCallId,
      pauseReason: s.pauseReason,
      callsToday: agentCallStats[s.agentId]?.count ?? 0,
      avgDurationToday: agentCallStats[s.agentId]?.avg ?? 0,
    }));

    const now = Date.now();
    const calls: RealtimeCall[] = activeCalls.map((c) => ({
      id: c.id,
      agentId: c.agentId,
      agentName: c.agent ? `${c.agent.firstName} ${c.agent.lastName}` : '—',
      callerNumber: c.callerNumber,
      calleeNumber: c.calleeNumber,
      direction: c.direction,
      status: c.status,
      duration: Math.floor((now - new Date(c.startedAt).getTime()) / 1000),
      startedAt: c.startedAt.toISOString(),
    }));

    const total = kpisRaw._count;
    const snapshot: RealtimeSnapshot = {
      tenantId,
      agents,
      activeCalls: calls,
      queues: [],
      dialer: (await this.dialer.getActiveSessions()).map((s) => ({ campaignId: s.campaignId, mode: s.mode, active: s.active })),
      spySessions: this.supervision.getActiveSessions(),
      kpis: {
        totalCallsToday: total,
        answeredToday: answered,
        answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
        avgDuration: Math.round(kpisRaw._avg.duration ?? 0),
        salesToday: sales,
        activeCallsNow: calls.length,
        agentsOnline: agents.length,
        agentsAvailable: agents.filter((a) => a.availability === 'AVAILABLE').length,
        agentsInCall: agents.filter((a) => a.availability === 'IN_CALL').length,
      },
      timestamp: new Date().toISOString(),
    };

    this.cache.set(tenantId, snapshot);
    return snapshot;
  }

  getCached(tenantId: string): RealtimeSnapshot | null {
    return this.cache.get(tenantId) ?? null;
  }

  private async getAgentCallStats(tenantId: string, since: Date) {
    const rows = await this.prisma.call.groupBy({
      by: ['agentId'],
      where: { tenantId, startedAt: { gte: since }, agentId: { not: null } },
      _count: true,
      _avg: { duration: true },
    });
    return Object.fromEntries(rows.map((r) => [r.agentId, { count: r._count, avg: Math.round(r._avg.duration ?? 0) }]));
  }

  @OnEvent('agent.state.changed')
  invalidateCache(data: { tenantId?: string }) {
    if (data.tenantId) this.cache.delete(data.tenantId);
  }
}
