import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface ScoreDetail {
  label: string;
  value: string | null;
  points: number;
  max: number;
  passed: boolean;
}

@Injectable()
export class ScoringEngineService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Calcul et persistance du score ──────────────────────────────────────

  async scoreAppointment(tenantId: string, appointmentId: string): Promise<void> {
    const appt = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId },
      include: {
        campaign: { include: { criteria: { include: { fields: true } } } },
        responses: true,
      },
    });

    if (!appt?.campaign?.criteria?.fields?.length) return;

    const { criteria, responses } = { criteria: appt.campaign.criteria, responses: appt.responses };
    let score = 0;
    let maxScore = 0;
    const details: Record<string, ScoreDetail> = {};

    for (const field of criteria.fields) {
      const weight = field.weight ?? 1;
      maxScore += weight;
      const response = responses.find((r) => r.fieldId === field.id);

      if (!response?.value) {
        details[field.key] = { label: field.label, value: null, points: 0, max: weight, passed: false };
        continue;
      }

      const points = this.evaluateField(field, response.value, weight);
      score += points;
      details[field.key] = { label: field.label, value: response.value, points, max: weight, passed: points === weight };
    }

    const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
    const status = maxScore === 0 ? 'PENDING' : percentage >= criteria.minScoreOk ? 'OK' : 'KO';

    await this.prisma.appointmentScore.upsert({
      where: { appointmentId },
      create: { tenantId, appointmentId, score, maxScore, percentage, status: status as any, details: details as any },
      update: { score, maxScore, percentage, status: status as any, details: details as any, updatedAt: new Date() },
    });
  }

  // ─── Révision manuelle (équipe qualité) ──────────────────────────────────

  async reviewScore(
    appointmentId: string,
    data: { status: 'OK' | 'KO'; reviewNotes?: string; reviewedById: string },
  ) {
    return this.prisma.appointmentScore.update({
      where: { appointmentId },
      data: { status: data.status, reviewNotes: data.reviewNotes, reviewedById: data.reviewedById, reviewedAt: new Date() },
    });
  }

  // ─── KPIs RDV ────────────────────────────────────────────────────────────

  async getKpi(tenantId: string, params: { from?: string; to?: string; agentId?: string; campaignId?: string }) {
    const { from, to, agentId, campaignId } = params;
    const apptWhere: any = { tenantId };
    if (agentId) apptWhere.agentId = agentId;
    if (campaignId) apptWhere.campaignId = campaignId;
    if (from || to) {
      apptWhere.startAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [total, byStatus, rawByAgent, rawByCampaign, convertedToSale] = await Promise.all([
      this.prisma.appointment.count({ where: apptWhere }),
      this.prisma.appointmentScore.groupBy({
        by: ['status'],
        where: { tenantId, appointment: apptWhere },
        _count: { id: true },
      }),
      this.prisma.appointment.groupBy({ by: ['agentId'], where: apptWhere, _count: { id: true } }),
      this.prisma.appointment.groupBy({
        by: ['campaignId'],
        where: { ...apptWhere, campaignId: { not: null } },
        _count: { id: true },
      }),
      this.prisma.sale.count({ where: { tenantId, appointment: apptWhere } }),
    ]);

    const counts = { ok: 0, ko: 0, pending: 0 };
    byStatus.forEach((s) => { counts[s.status.toLowerCase() as keyof typeof counts] = s._count.id; });

    const scored = counts.ok + counts.ko;

    // Enrichir agents avec noms
    const agentIds = rawByAgent.map((a) => a.agentId);
    const users = agentIds.length
      ? await this.prisma.user.findMany({ where: { id: { in: agentIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];

    const byAgent = rawByAgent.map((a) => ({
      agentId: a.agentId,
      count: a._count.id,
      agent: users.find((u) => u.id === a.agentId) ?? null,
    }));

    // Enrichir campagnes avec noms
    const campIds = rawByCampaign.map((c) => c.campaignId).filter(Boolean) as string[];
    const campaigns = campIds.length
      ? await this.prisma.campaign.findMany({ where: { id: { in: campIds } }, select: { id: true, name: true } })
      : [];

    const byCampaign = rawByCampaign.map((c) => ({
      campaignId: c.campaignId,
      count: c._count.id,
      campaign: campaigns.find((x) => x.id === c.campaignId) ?? null,
    }));

    return {
      total,
      scored,
      ok: counts.ok,
      ko: counts.ko,
      pending: counts.pending,
      tauxKo: scored > 0 ? +(counts.ko / scored * 100).toFixed(1) : 0,
      tauxTransformation: total > 0 ? +(convertedToSale / total * 100).toFixed(1) : 0,
      convertedToSale,
      byAgent,
      byCampaign,
    };
  }

  // ─── Évaluation d'un champ ───────────────────────────────────────────────

  private evaluateField(field: any, value: string, weight: number): number {
    if (!value) return 0;

    switch (field.type as string) {
      case 'BOOLEAN':
        return value === 'true' ? weight : 0;

      case 'NUMBER': {
        const num = parseFloat(value);
        if (isNaN(num)) return 0;
        const { min, max } = (field.validation ?? {}) as { min?: number; max?: number };
        if (min !== undefined && num < min) return 0;
        if (max !== undefined && num > max) return 0;
        return weight;
      }

      case 'SELECT':
      case 'MULTI_SELECT': {
        if (!field.options) return weight;
        const opts = field.options as Array<{ value: string; isPositive?: boolean }>;
        const positiveOpts = opts.filter((o) => o.isPositive !== false);
        if (positiveOpts.length === 0) return weight;
        const selected: string[] = field.type === 'MULTI_SELECT' ? this.parseMulti(value) : [value];
        const hasPositive = selected.some((v) => positiveOpts.some((o) => o.value === v));
        return hasPositive ? weight : 0;
      }

      case 'TEXT':
        return value.trim().length > 0 ? weight : 0;

      default:
        return weight;
    }
  }

  private parseMulti(value: string): string[] {
    try { return JSON.parse(value); } catch { return [value]; }
  }
}
