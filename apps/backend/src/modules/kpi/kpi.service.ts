import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

export interface KpiFilters {
  tenantId: string;
  agentId?: string;
  campaignId?: string;
  dateFrom: Date;
  dateTo: Date;
}

export interface KpiResult {
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  totalDurationSec: number;
  avgCallDurationSec: number;
  appointmentsSet: number;
  appointmentsValid: number;
  appointmentsCancelled: number;
  sales: number;
  hcCount: number;
  callbackCount: number;
  revenue: number;
  workingDays: number;
  // KPIs calculés
  ttr: number;       // Taux Transformation %
  tpr: number;       // Taux Production (RDV/jour)
  tauxHc: number;    // Taux HC %
  tauxContact: number;
  tauxNonReponse: number;
  tauAnnulation: number;
  productivite: number; // appels/heure
}

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Calcul KPI brut depuis DB ────────────────────────────────────────────

  async compute(filters: KpiFilters): Promise<KpiResult> {
    const { tenantId, agentId, campaignId, dateFrom, dateTo } = filters;
    const callWhere: any = { tenantId, startedAt: { gte: dateFrom, lte: dateTo } };
    const logWhere: any = { tenantId, createdAt: { gte: dateFrom, lte: dateTo } };
    const saleWhere: any = { tenantId, createdAt: { gte: dateFrom, lte: dateTo } };
    const apptWhere: any = { tenantId, startAt: { gte: dateFrom, lte: dateTo } };

    if (agentId) { callWhere.agentId = agentId; logWhere.agentId = agentId; saleWhere.agentId = agentId; apptWhere.agentId = agentId; }
    if (campaignId) { logWhere.campaignId = campaignId; saleWhere.campaignId = campaignId; }

    const [calls, callLogs, sales, appointments] = await Promise.all([
      this.prisma.call.findMany({ where: callWhere, select: { status: true, duration: true } }),
      this.prisma.callLog.findMany({ where: logWhere, select: { qualification: true, durationSec: true } }),
      this.prisma.sale.aggregate({ where: saleWhere, _sum: { amount: true }, _count: { id: true } }),
      this.prisma.appointment.groupBy({
        by: ['status'], where: apptWhere, _count: { id: true }, orderBy: { _count: { id: 'desc' } },
      }),
    ]);

    const totalCalls = calls.length;
    const answeredCalls = calls.filter((c) => c.status === 'ANSWERED').length;
    const missedCalls = totalCalls - answeredCalls;
    const totalDurationSec = calls.reduce((s, c) => s + (c.duration ?? 0), 0);
    const avgCallDurationSec = answeredCalls > 0 ? totalDurationSec / answeredCalls : 0;

    const apptMap: Record<string, number> = {};
    appointments.forEach((a) => { apptMap[a.status] = a._count.id; });
    const appointmentsSet = (apptMap.SCHEDULED ?? 0) + (apptMap.CONFIRMED ?? 0) + (apptMap.DONE ?? 0) + (apptMap.CANCELLED ?? 0);
    const appointmentsValid = (apptMap.CONFIRMED ?? 0) + (apptMap.DONE ?? 0);
    const appointmentsCancelled = apptMap.CANCELLED ?? 0;

    const qualifMap: Record<string, number> = {};
    callLogs.forEach((l) => { if (l.qualification) qualifMap[l.qualification] = (qualifMap[l.qualification] ?? 0) + 1; });
    const hcCount = qualifMap.NOT_INTERESTED ?? 0;
    const callbackCount = qualifMap.CALLBACK ?? 0;
    const saleCount = (qualifMap.SALE ?? 0) + (sales._count.id ?? 0);
    const revenue = Number(sales._sum.amount ?? 0);

    const workingDays = this._countWorkingDays(dateFrom, dateTo);

    return {
      totalCalls, answeredCalls, missedCalls, totalDurationSec, avgCallDurationSec,
      appointmentsSet, appointmentsValid, appointmentsCancelled,
      sales: saleCount, hcCount, callbackCount, revenue, workingDays,
      ttr: totalCalls > 0 ? (appointmentsValid / totalCalls) * 100 : 0,
      tpr: workingDays > 0 ? appointmentsSet / workingDays : 0,
      tauxHc: totalCalls > 0 ? (hcCount / totalCalls) * 100 : 0,
      tauxContact: totalCalls > 0 ? (answeredCalls / totalCalls) * 100 : 0,
      tauxNonReponse: totalCalls > 0 ? (missedCalls / totalCalls) * 100 : 0,
      tauAnnulation: appointmentsSet > 0 ? (appointmentsCancelled / appointmentsSet) * 100 : 0,
      productivite: workingDays > 0 ? totalCalls / (workingDays * 8) : 0, // appels/heure (8h/jour)
    };
  }

  // ─── KPI par agent (classement) ──────────────────────────────────────────

  async byAgent(tenantId: string, dateFrom: Date, dateTo: Date, campaignId?: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
    });
    const results = await Promise.all(
      agents.map(async (a) => ({
        agent: a,
        kpi: await this.compute({ tenantId, agentId: a.id, campaignId, dateFrom, dateTo }),
      }))
    );
    return results.sort((a, b) => b.kpi.ttr - a.kpi.ttr);
  }

  // ─── Série temporelle (courbe évolution) ─────────────────────────────────

  async timeSeries(filters: KpiFilters, granularity: 'day' | 'week' | 'month') {
    const { tenantId, agentId, campaignId, dateFrom, dateTo } = filters;
    const where: any = {
      tenantId,
      date: { gte: dateFrom, lte: dateTo },
    };
    if (agentId) where.agentId = agentId; else where.agentId = null;
    if (campaignId) where.campaignId = campaignId; else where.campaignId = null;

    const rows = await this.prisma.kpiDaily.findMany({ where, orderBy: { date: 'asc' } });

    if (granularity === 'day') return rows;

    // Agréger par semaine/mois
    const grouped: Record<string, any> = {};
    rows.forEach((r) => {
      const d = new Date(r.date);
      const key = granularity === 'week'
        ? `${d.getFullYear()}-W${this._weekNumber(d)}`
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!grouped[key]) grouped[key] = { period: key, totalCalls: 0, answeredCalls: 0, appointmentsSet: 0, appointmentsValid: 0, sales: 0, revenue: 0 };
      grouped[key].totalCalls += r.totalCalls;
      grouped[key].answeredCalls += r.answeredCalls;
      grouped[key].appointmentsSet += r.appointmentsSet;
      grouped[key].appointmentsValid += r.appointmentsValid;
      grouped[key].sales += r.sales;
      grouped[key].revenue += Number(r.revenue);
    });
    return Object.values(grouped);
  }

  // ─── Vérification alertes ─────────────────────────────────────────────────

  async checkAlerts(tenantId: string, kpi: KpiResult): Promise<string[]> {
    const rules = await this.prisma.alertRule.findMany({ where: { tenantId, isActive: true } });
    const suggestions: string[] = [];
    const metricMap: Record<string, number> = {
      ttr: kpi.ttr, tauxHc: kpi.tauxHc, tauAnnulation: kpi.tauAnnulation,
      avgCallDuration: kpi.avgCallDurationSec, tauxContact: kpi.tauxContact,
    };
    for (const rule of rules) {
      const val = metricMap[rule.metric] ?? 0;
      const triggered =
        (rule.operator === 'lt' && val < rule.threshold) ||
        (rule.operator === 'gt' && val > rule.threshold) ||
        (rule.operator === 'lte' && val <= rule.threshold) ||
        (rule.operator === 'gte' && val >= rule.threshold);
      if (triggered) {
        suggestions.push(`⚠️ ${rule.name} : ${rule.metric} = ${val.toFixed(1)} ${rule.operator} ${rule.threshold}`);
        await this.prisma.alertRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date() } });
      }
    }
    return suggestions;
  }

  // ─── Cron : agrégation quotidienne (2h du matin) ─────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async aggregateDaily() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const end = new Date(yesterday);
    end.setHours(23, 59, 59, 999);

    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      const agents = await this.prisma.user.findMany({
        where: { tenantId: t.id, isActive: true }, select: { id: true },
      });
      for (const a of agents) {
        const kpi = await this.compute({ tenantId: t.id, agentId: a.id, dateFrom: yesterday, dateTo: end });
        await this.prisma.kpiDaily.upsert({
          where: { tenantId_agentId_campaignId_date: { tenantId: t.id, agentId: a.id, campaignId: null as any, date: yesterday } },
          update: { ...this._kpiToRow(kpi) },
          create: { tenantId: t.id, agentId: a.id, date: yesterday, ...this._kpiToRow(kpi) },
        });
      }
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _kpiToRow(k: KpiResult) {
    return {
      totalCalls: k.totalCalls, answeredCalls: k.answeredCalls, missedCalls: k.missedCalls,
      totalDurationSec: k.totalDurationSec, appointmentsSet: k.appointmentsSet,
      appointmentsValid: k.appointmentsValid, appointmentsCancelled: k.appointmentsCancelled,
      sales: k.sales, hcCount: k.hcCount, callbackCount: k.callbackCount, revenue: k.revenue,
      ttr: k.ttr, tpr: k.tpr, tauxHc: k.tauxHc, tauxContact: k.tauxContact,
      tauxNonReponse: k.tauxNonReponse, tauAnnulation: k.tauAnnulation,
      avgCallDurationSec: k.avgCallDurationSec,
    };
  }

  private _countWorkingDays(start: Date, end: Date): number {
    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count || 1;
  }

  private _weekNumber(d: Date): number {
    const start = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
  }
}
