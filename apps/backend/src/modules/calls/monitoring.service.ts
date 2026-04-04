import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentStateService } from './agent-state.service';
import { DialerService } from './dialer.service';

export interface SupervisorSnapshot {
  agents: AgentStats[];
  queues: QueueStats[];
  today: TodayStats;
  dialer: DialerStats[];
  timestamp: string;
}

interface AgentStats {
  agentId: string;
  name: string;
  extension: string;
  availability: string;
  currentCallId: string | null;
  callsToday: number;
  avgDuration: number;
}

interface QueueStats {
  name: string;
  waiting: number;
  agentsAvailable: number;
  longestWait: number;
}

interface TodayStats {
  totalCalls: number;
  answered: number;
  answerRate: number;
  avgDuration: number;
  sales: number;
}

interface DialerStats {
  campaignId: string;
  mode: string;
  active: boolean;
}

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);
  private cache = new Map<string, SupervisorSnapshot>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentState: AgentStateService,
    private readonly dialer: DialerService,
  ) {}

  async getSnapshot(tenantId: string): Promise<SupervisorSnapshot> {
    const [agentSessions, todayStats] = await Promise.all([
      this.agentState.getAll(tenantId),
      this.getTodayStats(tenantId),
    ]);

    const agentIds = agentSessions.map((s) => s.agentId);
    const callsPerAgent = await this.getCallsPerAgent(tenantId, agentIds);

    const agents: AgentStats[] = agentSessions.map((s) => ({
      agentId: s.agentId,
      name: `${s.agent.firstName} ${s.agent.lastName}`,
      extension: s.extension,
      availability: s.availability,
      currentCallId: s.currentCallId,
      callsToday: callsPerAgent[s.agentId]?.count ?? 0,
      avgDuration: callsPerAgent[s.agentId]?.avgDuration ?? 0,
    }));

    const snapshot: SupervisorSnapshot = {
      agents,
      queues: [],
      today: todayStats,
      dialer: this.dialer.getActiveSessions().map((s) => ({
        campaignId: s.campaignId, mode: s.mode, active: s.active,
      })),
      timestamp: new Date().toISOString(),
    };

    this.cache.set(tenantId, snapshot);
    return snapshot;
  }

  private async getTodayStats(tenantId: string): Promise<TodayStats> {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [total, answered, sales, avgDur] = await Promise.all([
      this.prisma.call.count({ where: { tenantId, startedAt: { gte: today } } }),
      this.prisma.call.count({ where: { tenantId, status: 'ANSWERED', startedAt: { gte: today } } }),
      this.prisma.call.count({ where: { tenantId, disposition: 'SALE', startedAt: { gte: today } } }),
      this.prisma.call.aggregate({
        where: { tenantId, status: 'ANSWERED', startedAt: { gte: today } },
        _avg: { duration: true },
      }),
    ]);
    return {
      totalCalls: total,
      answered,
      answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
      avgDuration: Math.round(avgDur._avg.duration ?? 0),
      sales,
    };
  }

  private async getCallsPerAgent(tenantId: string, agentIds: string[]) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const results = await this.prisma.call.groupBy({
      by: ['agentId'],
      where: { tenantId, agentId: { in: agentIds }, startedAt: { gte: today } },
      _count: true,
      _avg: { duration: true },
    });
    return Object.fromEntries(
      results.map((r) => [r.agentId, { count: r._count, avgDuration: Math.round(r._avg.duration ?? 0) }]),
    );
  }

  // Invalide le cache sur changement d'état agent
  @OnEvent('agent.state.changed')
  onAgentStateChanged() {
    this.cache.clear();
  }
}
