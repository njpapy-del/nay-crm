import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEvaluationDto, QualifyAppointmentDto, CreateQualityActionDto, KpiQueryDto } from './dto/quality.dto';

const EVAL_INCLUDE = {
  agent: { select: { id: true, firstName: true, lastName: true } },
  evaluator: { select: { id: true, firstName: true, lastName: true } },
  grid: { select: { id: true, name: true } },
  items: { include: { gridItem: { select: { name: true, weight: true, maxScore: true } } } },
  callLog: { select: { id: true, callerNumber: true, calleeNumber: true, durationSec: true, createdAt: true } },
};

@Injectable()
export class QualityService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Évaluations ───────────────────────────────────────────

  async createEvaluation(tenantId: string, evaluatorId: string, dto: CreateEvaluationDto) {
    const grid = await this.prisma.qualityGrid.findFirst({
      where: { id: dto.gridId, tenantId },
      include: { items: true },
    });
    if (!grid) throw new NotFoundException('Grille introuvable');

    const { score, maxScore } = this.computeScore(dto.items, grid.items);

    const evaluation = await this.prisma.qualityEvaluation.create({
      data: {
        tenantId,
        callLogId: dto.callLogId,
        agentId: dto.agentId,
        evaluatorId,
        gridId: dto.gridId,
        score,
        maxScore,
        percentage: maxScore > 0 ? (score / maxScore) * 100 : 0,
        comment: dto.comment,
        items: {
          create: dto.items.map((i) => ({
            gridItemId: i.gridItemId,
            score: i.score,
            comment: i.comment,
          })),
        },
      },
      include: EVAL_INCLUDE,
    });
    return { data: evaluation };
  }

  async findEvaluations(tenantId: string, agentId?: string, from?: string, to?: string, skip = 0, limit = 20) {
    const where: any = { tenantId };
    if (agentId) where.agentId = agentId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }
    const [data, total] = await Promise.all([
      this.prisma.qualityEvaluation.findMany({ where, include: EVAL_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.qualityEvaluation.count({ where }),
    ]);
    return { data, meta: { total, skip, limit } };
  }

  async findOneEvaluation(tenantId: string, id: string) {
    const ev = await this.prisma.qualityEvaluation.findFirst({ where: { id, tenantId }, include: EVAL_INCLUDE });
    if (!ev) throw new NotFoundException('Évaluation introuvable');
    return { data: ev };
  }

  // ── Qualification RDV ─────────────────────────────────────

  async qualifyAppointment(tenantId: string, appointmentId: string, qualifiedById: string, dto: QualifyAppointmentDto) {
    const appt = await this.prisma.appointment.findFirst({ where: { id: appointmentId, tenantId } });
    if (!appt) throw new NotFoundException('RDV introuvable');

    const qualification = await this.prisma.appointmentQualification.upsert({
      where: { appointmentId },
      create: { tenantId, appointmentId, qualifiedById, ...dto },
      update: { qualifiedById, ...dto, updatedAt: new Date() },
      include: {
        qualifiedBy: { select: { id: true, firstName: true, lastName: true } },
        appointment: { select: { id: true, title: true, startAt: true } },
      },
    });
    return { data: qualification };
  }

  async findQualifications(tenantId: string, status?: string, agentId?: string, skip = 0, limit = 20) {
    const where: any = { tenantId };
    if (status) where.status = status;
    if (agentId) {
      where.appointment = { agentId };
    }
    const [data, total] = await Promise.all([
      this.prisma.appointmentQualification.findMany({
        where,
        include: {
          qualifiedBy: { select: { id: true, firstName: true, lastName: true } },
          appointment: {
            select: { id: true, title: true, startAt: true, agent: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.appointmentQualification.count({ where }),
    ]);
    return { data, meta: { total, skip, limit } };
  }

  // ── Actions correctives ───────────────────────────────────

  async createAction(tenantId: string, createdById: string, dto: CreateQualityActionDto) {
    const action = await this.prisma.qualityAction.create({
      data: { tenantId, createdById, ...dto },
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return { data: action };
  }

  async findActions(tenantId: string, agentId?: string) {
    const where: any = { tenantId };
    if (agentId) where.agentId = agentId;
    const data = await this.prisma.qualityAction.findMany({
      where,
      include: {
        agent: { select: { id: true, firstName: true, lastName: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { data };
  }

  // ── KPI ───────────────────────────────────────────────────

  async getKpi(tenantId: string, q: KpiQueryDto) {
    const where: any = { tenantId };
    if (q.agentId) where.agentId = q.agentId;
    if (q.from || q.to) {
      where.createdAt = {};
      if (q.from) where.createdAt.gte = new Date(q.from);
      if (q.to) where.createdAt.lte = new Date(q.to);
    }

    const [evaluations, qualifTotal, qualifStats] = await Promise.all([
      this.prisma.qualityEvaluation.findMany({ where, select: { agentId: true, percentage: true, agent: { select: { firstName: true, lastName: true } } } }),
      this.prisma.appointmentQualification.count({ where: { tenantId } }),
      this.prisma.appointmentQualification.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: true,
      }),
    ]);

    const avgScore = evaluations.length ? evaluations.reduce((s, e) => s + e.percentage, 0) / evaluations.length : 0;

    const byAgent: Record<string, { name: string; count: number; avg: number }> = {};
    for (const ev of evaluations) {
      if (!byAgent[ev.agentId]) byAgent[ev.agentId] = { name: `${ev.agent.firstName} ${ev.agent.lastName}`, count: 0, avg: 0 };
      byAgent[ev.agentId].count++;
      byAgent[ev.agentId].avg += ev.percentage;
    }
    for (const v of Object.values(byAgent)) v.avg = v.count > 0 ? v.avg / v.count : 0;

    const statusMap = Object.fromEntries(qualifStats.map((s) => [s.status, s._count]));

    return {
      data: {
        totalEvaluations: evaluations.length,
        avgScore: +avgScore.toFixed(1),
        qualifications: {
          total: qualifTotal,
          ok: statusMap['OK'] ?? 0,
          ko: statusMap['KO'] ?? 0,
          hcc: statusMap['HCC'] ?? 0,
          hc: statusMap['HC'] ?? 0,
        },
        byAgent: Object.entries(byAgent).map(([id, v]) => ({ agentId: id, ...v, avg: +v.avg.toFixed(1) })),
      },
    };
  }

  // ── Helpers ───────────────────────────────────────────────

  private computeScore(items: { gridItemId: string; score: number }[], gridItems: { id: string; weight: number; maxScore: number }[]) {
    let score = 0;
    let maxScore = 0;
    for (const item of items) {
      const gi = gridItems.find((g) => g.id === item.gridItemId);
      if (!gi) continue;
      score += item.score * gi.weight;
      maxScore += gi.maxScore * gi.weight;
    }
    return { score, maxScore };
  }
}
