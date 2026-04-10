import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ScoringEngineService } from '../scoring-engine/scoring-engine.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/create-appointment.dto';
import { ReviewScoreDto } from '../campaign-criteria/dto/upsert-criteria.dto';

const APPOINTMENT_INCLUDE = {
  agent:    { select: { id: true, firstName: true, lastName: true } },
  lead:     { select: { id: true, firstName: true, lastName: true, phone: true } },
  campaign: { select: { id: true, name: true } },
  client:   { select: { id: true, firstName: true, lastName: true, company: true } },
  responses: { include: { field: { select: { id: true, label: true, key: true, type: true } } } },
  score:    true,
} as const;

@Injectable()
export class AppointmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: ScoringEngineService,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, params: {
    agentId?: string; from?: string; to?: string;
    campaignId?: string; status?: string;
  }) {
    const { agentId, from, to, campaignId, status } = params;
    const where: any = { tenantId };
    if (agentId)    where.agentId    = agentId;
    if (campaignId) where.campaignId = campaignId;
    if (status)     where.status     = status;
    if (from || to) where.startAt    = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to   ? { lte: new Date(to)   } : {}),
    };

    const data = await this.prisma.appointment.findMany({
      where, include: APPOINTMENT_INCLUDE, orderBy: { startAt: 'asc' },
    });
    return { data };
  }

  async findOne(tenantId: string, id: string) {
    const appt = await this.prisma.appointment.findFirst({
      where: { id, tenantId }, include: APPOINTMENT_INCLUDE,
    });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    return appt;
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    const { responses, ...rest } = dto;

    const appt = await this.prisma.appointment.create({
      data: {
        tenantId,
        ...rest,
        startAt: new Date(dto.startAt),
        endAt:   new Date(dto.endAt),
        ...(responses?.length ? {
          responses: {
            create: responses.map((r) => ({ tenantId, fieldId: r.fieldId, value: r.value })),
          },
        } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    });

    // Calcul automatique du score si réponses fournies
    if (responses?.length) {
      await this.scoring.scoreAppointment(tenantId, appt.id).catch(() => null);
    }

    return this.findOne(tenantId, appt.id);
  }

  async update(tenantId: string, id: string, dto: Partial<CreateAppointmentDto>) {
    await this.findOne(tenantId, id);
    const { responses, ...rest } = dto;

    await this.prisma.appointment.update({
      where: { id },
      data: {
        ...rest,
        startAt: rest.startAt ? new Date(rest.startAt) : undefined,
        endAt:   rest.endAt   ? new Date(rest.endAt)   : undefined,
      },
    });

    // Mettre à jour les réponses si fournies
    if (responses) {
      await this.prisma.appointmentResponse.deleteMany({ where: { appointmentId: id } });
      if (responses.length) {
        await this.prisma.appointmentResponse.createMany({
          data: responses.map((r) => ({ tenantId, appointmentId: id, fieldId: r.fieldId, value: r.value })),
        });
        await this.scoring.scoreAppointment(tenantId, id).catch(() => null);
      }
    }

    return this.findOne(tenantId, id);
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateAppointmentStatusDto) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id }, data: { status: dto.status }, include: APPOINTMENT_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.appointment.delete({ where: { id } });
  }

  // ─── Scoring / Révision ────────────────────────────────────────────────

  async recalcScore(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.scoring.scoreAppointment(tenantId, id);
    return this.findOne(tenantId, id);
  }

  async reviewScore(tenantId: string, id: string, dto: ReviewScoreDto, userId: string) {
    await this.findOne(tenantId, id);
    await this.scoring.reviewScore(id, { ...dto, reviewedById: userId });
    return this.findOne(tenantId, id);
  }

  // ─── KPI ─────────────────────────────────────────────────────────────────

  async getKpi(tenantId: string, params: { from?: string; to?: string; agentId?: string; campaignId?: string }) {
    return this.scoring.getKpi(tenantId, params);
  }
}
