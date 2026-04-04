import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IsOptional, IsString, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContactStatus } from '@prisma/client';

export class FilterRecyclingDto {
  @IsOptional() @IsString() listId?: string;
  @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 50;
}

export class ScheduleRecallDto {
  @IsString() contactId: string;
  @IsString() scheduledAt: string;
  @IsOptional() @IsString() reason?: string;
}

@Injectable()
export class RecyclingService {
  constructor(private readonly prisma: PrismaService) {}

  /** Contacts à recycler : CALLBACK, OUT_OF_TARGET, non joignables */
  async getToRecycle(tenantId: string, filters: FilterRecyclingDto) {
    const { listId, status, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const recyclableStatuses: ContactStatus[] = ['CALLBACK', 'REFUSED', 'OUT_OF_TARGET'];
    const where: any = {
      tenantId,
      status: status ? { equals: status } : { in: recyclableStatuses },
    };
    if (listId) where.listId = listId;

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where, skip, take: limit,
        orderBy: [{ nextCallAt: 'asc' }, { updatedAt: 'desc' }],
        include: { list: { select: { id: true, name: true } } },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Planifier un rappel */
  async scheduleRecall(tenantId: string, agentId: string, dto: ScheduleRecallDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, tenantId },
    });
    if (!contact) return null;

    await this.prisma.$transaction([
      this.prisma.recyclingLog.create({
        data: {
          tenantId,
          contactId: dto.contactId,
          agentId,
          previousStatus: contact.status,
          newStatus: 'CALLBACK',
          reason: dto.reason ?? null,
          scheduledAt: new Date(dto.scheduledAt),
        },
      }),
      this.prisma.contact.update({
        where: { id: dto.contactId },
        data: { status: 'CALLBACK', nextCallAt: new Date(dto.scheduledAt) },
      }),
    ]);

    return { success: true };
  }

  /** Logs de recyclage */
  async getLogs(tenantId: string, filters: FilterRecyclingDto) {
    const { listId, agentId, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (agentId) where.agentId = agentId;
    if (listId) where.contact = { listId };

    const [data, total] = await Promise.all([
      this.prisma.recyclingLog.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
          agent: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.recyclingLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /** Stats recyclage par statut */
  async getStats(tenantId: string) {
    const stats = await this.prisma.contact.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: { id: true },
    });
    return Object.fromEntries(stats.map((s) => [s.status, s._count.id]));
  }
}
