import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateContactDto, FilterContactsDto, BulkStatusDto } from './dto/contact.dto';
import { ContactStatus } from '@prisma/client';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, listId: string, filters: FilterContactsDto) {
    const { search, status, dateFrom, dateTo, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, listId };
    if (status) where.status = status;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName:  { contains: search, mode: 'insensitive' } },
        { phone:     { contains: search } },
        { email:     { contains: search, mode: 'insensitive' } },
        { company:   { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.contact.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const contact = await this.prisma.contact.findFirst({ where: { id, tenantId } });
    if (!contact) throw new NotFoundException('Contact introuvable');
    return contact;
  }

  async update(tenantId: string, id: string, dto: UpdateContactDto) {
    const contact = await this.findOne(tenantId, id);

    if (dto.status && dto.status !== contact.status) {
      await this.prisma.recyclingLog.create({
        data: {
          tenantId,
          contactId: id,
          previousStatus: contact.status,
          newStatus: dto.status as ContactStatus,
          scheduledAt: dto.nextCallAt ? new Date(dto.nextCallAt) : null,
        },
      });
    }

    return this.prisma.contact.update({
      where: { id },
      data: {
        ...dto,
        nextCallAt: dto.nextCallAt ? new Date(dto.nextCallAt) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.contact.delete({ where: { id } });
    return { success: true };
  }

  async bulkUpdateStatus(tenantId: string, dto: BulkStatusDto) {
    const contacts = await this.prisma.contact.findMany({
      where: { id: { in: dto.ids }, tenantId },
      select: { id: true, status: true },
    });

    const logs = contacts
      .filter((c) => c.status !== dto.status)
      .map((c) => ({
        tenantId,
        contactId: c.id,
        previousStatus: c.status,
        newStatus: dto.status,
        reason: dto.reason ?? null,
      }));

    await this.prisma.$transaction([
      this.prisma.recyclingLog.createMany({ data: logs }),
      this.prisma.contact.updateMany({
        where: { id: { in: dto.ids }, tenantId },
        data: { status: dto.status },
      }),
    ]);

    return { updated: dto.ids.length };
  }

  async isBlacklisted(tenantId: string, phone: string, campaignId?: string): Promise<boolean> {
    const normalized = this.normalizePhone(phone);
    const entry = await this.prisma.blacklistEntry.findFirst({
      where: {
        tenantId,
        phone: normalized,
        isActive: true,
        blacklist: {
          OR: [
            { scope: 'TENANT' },
            { scope: 'GLOBAL' },
            ...(campaignId ? [{ scope: 'CAMPAIGN' as const, campaignId }] : []),
          ],
        },
      },
    });
    return !!entry;
  }

  async exportCsv(tenantId: string, listId: string, filters: FilterContactsDto): Promise<string> {
    const allFilters = { ...filters, page: 1, limit: 100000 };
    const { data } = await this.findAll(tenantId, listId, allFilters);

    const header = 'Prénom,Nom,Téléphone,Email,Société,Statut,Tentatives,Dernier appel';
    const rows = data.map((c) => [
      c.firstName ?? '', c.lastName ?? '', c.phone, c.email ?? '',
      c.company ?? '', c.status, c.attemptCount,
      c.lastCalledAt ? c.lastCalledAt.toISOString() : '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [header, ...rows].join('\n');
  }

  normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '').replace(/[^\d+]/g, '');
  }
}
