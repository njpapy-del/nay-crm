import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertAppointmentDto } from './dto/upsert-appointment.dto';
import { FilterAppointmentDto } from './dto/filter-appointment.dto';

const APPT_INCLUDE = {
  agent:    { select: { id: true, firstName: true, lastName: true } },
  lead:     { select: { id: true, firstName: true, lastName: true, phone: true } },
  client:   { select: { id: true, firstName: true, lastName: true, company: true } },
  campaign: { select: { id: true, name: true } },
} as const;

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Filtrage ─────────────────────────────────────────────

  private buildWhere(tenantId: string, dto: FilterAppointmentDto) {
    const where: any = { tenantId };
    if (dto.agentId)    where.agentId    = dto.agentId;
    if (dto.campaignId) where.campaignId = dto.campaignId;
    if (dto.clientId)   where.clientId   = dto.clientId;
    if (dto.status)     where.status     = dto.status;
    if (dto.from || dto.to) {
      where.startAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to   ? { lte: new Date(dto.to)   } : {}),
      };
    }
    return where;
  }

  // ── CRUD ─────────────────────────────────────────────────

  async findAll(tenantId: string, dto: FilterAppointmentDto) {
    const where = this.buildWhere(tenantId, dto);
    const skip  = dto.skip  ?? 0;
    const take  = dto.limit ?? 200;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.appointment.findMany({
        where, include: APPT_INCLUDE, orderBy: { startAt: 'asc' }, skip, take,
      }),
      this.prisma.appointment.count({ where }),
    ]);
    return { data, meta: { total, skip, take } };
  }

  async findOne(tenantId: string, id: string) {
    const appt = await this.prisma.appointment.findFirst({ where: { id, tenantId }, include: APPT_INCLUDE });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    return appt;
  }

  async create(tenantId: string, dto: UpsertAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        tenantId,
        agentId:     dto.agentId,
        title:       dto.title,
        startAt:     new Date(dto.startAt),
        endAt:       new Date(dto.endAt),
        description: dto.description,
        leadId:      dto.leadId,
        clientId:    dto.clientId,
        campaignId:  dto.campaignId,
        status:      dto.status ?? 'SCHEDULED',
      },
      include: APPT_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: Partial<UpsertAppointmentDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...(dto.agentId     !== undefined ? { agentId:     dto.agentId     } : {}),
        ...(dto.title       !== undefined ? { title:       dto.title       } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.startAt     !== undefined ? { startAt:     new Date(dto.startAt) } : {}),
        ...(dto.endAt       !== undefined ? { endAt:       new Date(dto.endAt)   } : {}),
        ...(dto.status      !== undefined ? { status:      dto.status      } : {}),
        ...(dto.leadId      !== undefined ? { leadId:      dto.leadId      } : {}),
        ...(dto.clientId    !== undefined ? { clientId:    dto.clientId    } : {}),
        ...(dto.campaignId  !== undefined ? { campaignId:  dto.campaignId  } : {}),
      },
      include: APPT_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.appointment.delete({ where: { id } });
  }

  // ── Dispatching ───────────────────────────────────────────

  async agentWorkload(tenantId: string, from: string, to: string) {
    const agents = await this.prisma.user.findMany({
      where: { tenantId, isActive: true, role: 'AGENT' },
      select: { id: true, firstName: true, lastName: true },
    });

    const counts = await this.prisma.appointment.groupBy({
      by: ['agentId'],
      where: { tenantId, startAt: { gte: new Date(from), lte: new Date(to) }, status: { not: 'CANCELLED' } },
      _count: { id: true },
    });

    const countMap = Object.fromEntries(counts.map((c) => [c.agentId, c._count.id]));
    return agents.map((a) => ({ ...a, appointmentCount: countMap[a.id] ?? 0 }))
                 .sort((a, b) => a.appointmentCount - b.appointmentCount);
  }

  async dispatch(tenantId: string, appointmentId: string) {
    const appt = await this.findOne(tenantId, appointmentId);
    const { startAt, endAt } = appt;
    const from = startAt.toISOString().slice(0, 10);
    const to   = endAt.toISOString().slice(0, 10);
    const ranked = await this.agentWorkload(tenantId, from + 'T00:00:00Z', to + 'T23:59:59Z');
    if (!ranked.length) throw new NotFoundException('Aucun agent disponible');
    return this.update(tenantId, appointmentId, { agentId: ranked[0].id });
  }
}
