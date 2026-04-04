import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateListDto, UpdateListDto, FilterListsDto } from './dto/list.dto';
import { ContactListStatus } from '@prisma/client';

@Injectable()
export class ContactListService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters: FilterListsDto) {
    const { search, status, campaignId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (campaignId) where.campaignId = campaignId;
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const [data, total] = await Promise.all([
      this.prisma.contactList.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { contacts: true, imports: true } },
        },
      }),
      this.prisma.contactList.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(tenantId: string, id: string) {
    const list = await this.prisma.contactList.findFirst({
      where: { id, tenantId },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { contacts: true, imports: true } },
      },
    });
    if (!list) throw new NotFoundException('Liste introuvable');
    return list;
  }

  async create(tenantId: string, userId: string, dto: CreateListDto) {
    return this.prisma.contactList.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        source: dto.source,
        description: dto.description,
        campaignId: dto.campaignId ?? null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateListDto) {
    await this.findOne(tenantId, id);
    return this.prisma.contactList.update({
      where: { id },
      data: dto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.contactList.delete({ where: { id } });
    return { success: true };
  }

  async getStats(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const stats = await this.prisma.contact.groupBy({
      by: ['status'],
      where: { listId: id, tenantId },
      _count: { id: true },
    });
    return Object.fromEntries(stats.map((s) => [s.status, s._count.id]));
  }

  async exportCsv(tenantId: string, id: string): Promise<string> {
    await this.findOne(tenantId, id);
    const contacts = await this.prisma.contact.findMany({
      where: { listId: id, tenantId },
      select: {
        firstName: true, lastName: true, phone: true,
        email: true, company: true, status: true,
        attemptCount: true, lastCalledAt: true, notes: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const header = 'Prénom,Nom,Téléphone,Email,Société,Statut,Tentatives,Dernier appel,Notes';
    const rows = contacts.map((c) => [
      c.firstName ?? '', c.lastName ?? '', c.phone, c.email ?? '',
      c.company ?? '', c.status, c.attemptCount,
      c.lastCalledAt ? c.lastCalledAt.toISOString() : '', c.notes ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

    return [header, ...rows].join('\n');
  }

  async syncTotalContacts(listId: string) {
    const count = await this.prisma.contact.count({ where: { listId } });
    await this.prisma.contactList.update({ where: { id: listId }, data: { totalContacts: count } });
  }
}
