import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface AnalyticsFilters {
  tenantId: string;
  dateFrom: Date;
  dateTo: Date;
  agentId?: string;
  campaignId?: string;
  groupBy?: 'agent' | 'campaign' | 'day' | 'week' | 'month';
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Dashboard global ─────────────────────────────────────────────────────

  async getDashboard(tenantId: string, dateFrom: Date, dateTo: Date) {
    const [
      callStats, qualifStats, saleStats, apptStats,
      activeAgents, activeCampaigns, recentCalls,
    ] = await Promise.all([
      this._callStats(tenantId, dateFrom, dateTo),
      this._qualifBreakdown(tenantId, dateFrom, dateTo),
      this._saleStats(tenantId, dateFrom, dateTo),
      this._apptStats(tenantId, dateFrom, dateTo),
      this.prisma.agentSession.count({ where: { tenantId, availability: { not: 'OFFLINE' } } }),
      this.prisma.campaign.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.callLog.findMany({
        where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
        take: 10, orderBy: { createdAt: 'desc' },
        include: { agent: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    return {
      calls: callStats,
      qualifications: qualifStats,
      sales: saleStats,
      appointments: apptStats,
      activeAgents,
      activeCampaigns,
      recentCalls,
    };
  }

  // ─── Breakdown appels par qualification ──────────────────────────────────

  async callsByQualification(tenantId: string, dateFrom: Date, dateTo: Date, campaignId?: string) {
    const where: any = { tenantId, createdAt: { gte: dateFrom, lte: dateTo } };
    if (campaignId) where.campaignId = campaignId;
    return this.prisma.callLog.groupBy({
      by: ['qualification'], where,
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    });
  }

  // ─── Appels par heure (distribution intraday) ─────────────────────────────

  async callsByHour(tenantId: string, dateFrom: Date, dateTo: Date) {
    const logs = await this.prisma.callLog.findMany({
      where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
      select: { createdAt: true },
    });
    const hourMap: Record<number, number> = {};
    for (let h = 0; h < 24; h++) hourMap[h] = 0;
    logs.forEach((l) => { hourMap[new Date(l.createdAt).getHours()]++; });
    return Object.entries(hourMap).map(([hour, count]) => ({ hour: +hour, count }));
  }

  // ─── Performance campagne ─────────────────────────────────────────────────

  async byCampaign(tenantId: string, dateFrom: Date, dateTo: Date) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { tenantId },
      select: { id: true, name: true, status: true, _count: { select: { leads: true, callLogs: true } } },
    });
    const results = await Promise.all(campaigns.map(async (c) => {
      const [sales, appts] = await Promise.all([
        this.prisma.sale.count({ where: { tenantId, campaignId: c.id, createdAt: { gte: dateFrom, lte: dateTo } } }),
        this.prisma.appointment.count({ where: { tenantId, campaignId: c.id, status: { in: ['CONFIRMED', 'DONE'] }, startAt: { gte: dateFrom, lte: dateTo } } }),
      ]);
      const ttr = c._count.callLogs > 0 ? (appts / c._count.callLogs) * 100 : 0;
      return { ...c, sales, appointments: appts, ttr: Math.round(ttr * 10) / 10 };
    }));
    return results.sort((a, b) => b.ttr - a.ttr);
  }

  // ─── Évolution CA ─────────────────────────────────────────────────────────

  async revenueTimeSeries(tenantId: string, dateFrom: Date, dateTo: Date) {
    const sales = await this.prisma.sale.findMany({
      where: { tenantId, status: 'CONFIRMED', createdAt: { gte: dateFrom, lte: dateTo } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const byDay: Record<string, number> = {};
    sales.forEach((s) => {
      const day = s.createdAt.toISOString().split('T')[0];
      byDay[day] = (byDay[day] ?? 0) + Number(s.amount);
    });
    return Object.entries(byDay).map(([date, revenue]) => ({ date, revenue }));
  }

  // ─── Temps réel ───────────────────────────────────────────────────────────

  async getRealtime(tenantId: string) {
    const [agentSessions, activeCalls] = await Promise.all([
      this.prisma.agentSession.findMany({
        where: { tenantId },
        include: { agent: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.call.count({ where: { tenantId, status: { in: ['ANSWERED', 'RINGING'] } } }),
    ]);
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCalls = await this.prisma.call.count({ where: { tenantId, startedAt: { gte: todayStart } } });
    return { agentSessions, activeCalls, todayCalls };
  }

  // ─── Privés ───────────────────────────────────────────────────────────────

  private async _callStats(tenantId: string, dateFrom: Date, dateTo: Date) {
    const where = { tenantId, startedAt: { gte: dateFrom, lte: dateTo } };
    const [total, answered] = await Promise.all([
      this.prisma.call.count({ where }),
      this.prisma.call.count({ where: { ...where, status: 'ANSWERED' } }),
    ]);
    const agg = await this.prisma.call.aggregate({ where: { ...where, status: 'ANSWERED' }, _avg: { duration: true }, _sum: { duration: true } });
    return { total, answered, missed: total - answered, avgDuration: Math.round(agg._avg.duration ?? 0), totalDuration: agg._sum.duration ?? 0 };
  }

  private async _qualifBreakdown(tenantId: string, dateFrom: Date, dateTo: Date) {
    const rows = await this.prisma.callLog.groupBy({
      by: ['qualification'], where: { tenantId, createdAt: { gte: dateFrom, lte: dateTo } },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    });
    return rows.map((r) => ({ qualification: r.qualification, count: r._count.id }));
  }

  private async _saleStats(tenantId: string, dateFrom: Date, dateTo: Date) {
    const where = { tenantId, createdAt: { gte: dateFrom, lte: dateTo } };
    const agg = await this.prisma.sale.aggregate({ where, _sum: { amount: true }, _count: { id: true } });
    return { count: agg._count.id, revenue: Number(agg._sum.amount ?? 0) };
  }

  private async _apptStats(tenantId: string, dateFrom: Date, dateTo: Date) {
    const rows = await this.prisma.appointment.groupBy({
      by: ['status'], where: { tenantId, startAt: { gte: dateFrom, lte: dateTo } },
      _count: { id: true }, orderBy: { _count: { id: 'desc' } },
    });
    const m: Record<string, number> = {};
    rows.forEach((r) => { m[r.status] = r._count.id; });
    return { scheduled: m.SCHEDULED ?? 0, confirmed: m.CONFIRMED ?? 0, done: m.DONE ?? 0, cancelled: m.CANCELLED ?? 0 };
  }
}
