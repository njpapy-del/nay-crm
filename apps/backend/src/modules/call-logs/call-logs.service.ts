import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterCallLogsDto, UpdateCallLogDto, CreateCallLogDto } from './dto/call-log.dto';

const QUALIFICATION_LABELS: Record<string, string> = {
  SALE: 'Vente', APPOINTMENT: 'RDV', NOT_INTERESTED: 'Pas intéressé',
  CALLBACK: 'À rappeler', WRONG_NUMBER: 'Faux numéro',
  VOICEMAIL: 'Répondeur', DNC: 'DNC', OTHER: 'Autre',
};

@Injectable()
export class CallLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters: FilterCallLogsDto) {
    const { agentId, campaignId, phone, qualification, status,
      dateFrom, dateTo, minDuration, search, page = 1, limit = 30 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (agentId)       where.agentId    = agentId;
    if (campaignId)    where.campaignId = campaignId;
    if (qualification) where.qualification = qualification;
    if (status)        where.status     = status;
    if (minDuration !== undefined) where.durationSec = { gte: minDuration };

    if (phone) {
      where.OR = [
        { callerNumber: { contains: phone } },
        { calleeNumber: { contains: phone } },
      ];
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    if (search) {
      where.AND = [{
        agent: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
          ],
        },
      }];
    }

    const [data, total] = await Promise.all([
      this.prisma.callLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent:    { select: { id: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
          call: {
            select: {
              id: true, direction: true, status: true, asteriskId: true,
              client: { select: { id: true, firstName: true, lastName: true } },
              lead:   { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      this.prisma.callLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const log = await this.prisma.callLog.findFirst({
      where: { id, tenantId },
      include: {
        agent:    { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true } },
        call: {
          include: {
            client:    { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
            lead:      { select: { id: true, firstName: true, lastName: true, phone: true } },
            recording: { select: { id: true, fileName: true, durationSec: true, format: true } },
          },
        },
      },
    });
    if (!log) throw new NotFoundException('Journal introuvable');
    return log;
  }

  async create(tenantId: string, dto: CreateCallLogDto) {
    const call = await this.prisma.call.findFirst({ where: { id: dto.callId, tenantId } });
    if (!call) throw new NotFoundException('Appel introuvable');

    return this.prisma.callLog.upsert({
      where: { callId: dto.callId },
      create: {
        tenantId,
        callId:      dto.callId,
        agentId:     dto.agentId  ?? call.agentId  ?? null,
        campaignId:  dto.campaignId ?? null,
        callerNumber: call.callerNumber,
        calleeNumber: call.calleeNumber,
        durationSec:  call.duration ?? 0,
        qualification: dto.qualification ?? null,
        notes: dto.notes ?? null,
      },
      update: {
        qualification: dto.qualification ?? undefined,
        notes: dto.notes ?? undefined,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCallLogDto) {
    await this.findOne(tenantId, id);
    const data: any = { ...dto };
    if (dto.qualification) data.qualifiedAt = new Date();
    if (dto.status === 'REVIEWED') data.reviewedAt = new Date();
    return this.prisma.callLog.update({ where: { id }, data });
  }

  async getStats(tenantId: string, dateFrom?: string, dateTo?: string) {
    const where: any = { tenantId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    const [byQualification, byStatus, total] = await Promise.all([
      this.prisma.callLog.groupBy({
        by: ['qualification'], where, _count: { id: true },
      }),
      this.prisma.callLog.groupBy({
        by: ['status'], where, _count: { id: true },
      }),
      this.prisma.callLog.count({ where }),
    ]);

    return {
      total,
      byQualification: Object.fromEntries(
        byQualification.map((r) => [r.qualification ?? 'NONE', r._count.id]),
      ),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
    };
  }

  async exportCsv(tenantId: string, filters: FilterCallLogsDto): Promise<string> {
    const { data } = await this.findAll(tenantId, { ...filters, limit: 100000 });
    const header = 'Date,Agent,De,Vers,Durée (s),Qualification,Statut,Notes,Campagne';
    const rows = data.map((l) => [
      new Date(l.createdAt).toLocaleString('fr-FR'),
      l.agent ? `${l.agent.firstName} ${l.agent.lastName}` : '',
      l.callerNumber, l.calleeNumber, l.durationSec,
      l.qualification ? (QUALIFICATION_LABELS[l.qualification] ?? l.qualification) : '',
      l.status, l.notes ?? '', l.campaign?.name ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    return [header, ...rows].join('\n');
  }
}
