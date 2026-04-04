import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/create-appointment.dto';

const APPOINTMENT_INCLUDE = {
  agent: { select: { id: true, firstName: true, lastName: true } },
  lead: { select: { id: true, firstName: true, lastName: true, phone: true } },
  campaign: { select: { id: true, name: true } },
  client: { select: { id: true, firstName: true, lastName: true, company: true } },
} as const;

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { agentId?: string; from?: string; to?: string; campaignId?: string }) {
    const { agentId, from, to, campaignId } = params;
    const where: any = { tenantId };
    if (agentId) where.agentId = agentId;
    if (campaignId) where.campaignId = campaignId;
    if (from || to) where.startAt = { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) };

    const data = await this.prisma.appointment.findMany({
      where, include: APPOINTMENT_INCLUDE, orderBy: { startAt: 'asc' },
    });
    return { data };
  }

  async findOne(tenantId: string, id: string) {
    const appt = await this.prisma.appointment.findFirst({ where: { id, tenantId }, include: APPOINTMENT_INCLUDE });
    if (!appt) throw new NotFoundException('Rendez-vous introuvable');
    return appt;
  }

  async create(tenantId: string, dto: CreateAppointmentDto) {
    return this.prisma.appointment.create({
      data: {
        tenantId,
        ...dto,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: Partial<CreateAppointmentDto>) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({
      where: { id },
      data: {
        ...dto,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      },
      include: APPOINTMENT_INCLUDE,
    });
  }

  async updateStatus(tenantId: string, id: string, dto: UpdateAppointmentStatusDto) {
    await this.findOne(tenantId, id);
    return this.prisma.appointment.update({ where: { id }, data: { status: dto.status }, include: APPOINTMENT_INCLUDE });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.appointment.delete({ where: { id } });
  }
}
