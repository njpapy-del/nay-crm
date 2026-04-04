import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBlacklistDto, AddEntryDto, BulkAddEntriesDto, FilterBlacklistDto,
} from './dto/blacklist.dto';
import { parse } from 'csv-parse/sync';

@Injectable()
export class BlacklistService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Listes blacklist ──────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.blacklist.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { entries: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const bl = await this.prisma.blacklist.findFirst({
      where: { id, tenantId },
      include: { _count: { select: { entries: true } } },
    });
    if (!bl) throw new NotFoundException('Blacklist introuvable');
    return bl;
  }

  async create(tenantId: string, userId: string, dto: CreateBlacklistDto) {
    return this.prisma.blacklist.create({
      data: {
        tenantId,
        createdById: userId,
        name: dto.name,
        scope: dto.scope ?? 'TENANT',
        description: dto.description ?? null,
        campaignId: dto.campaignId ?? null,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.blacklist.delete({ where: { id } });
    return { success: true };
  }

  // ── Entrées ───────────────────────────────────────────

  async getEntries(tenantId: string, blacklistId: string, filters: FilterBlacklistDto) {
    await this.findOne(tenantId, blacklistId);
    const { search, page = 1, limit = 50 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { blacklistId, tenantId, isActive: true };
    if (search) where.phone = { contains: search };

    const [data, total] = await Promise.all([
      this.prisma.blacklistEntry.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: { addedBy: { select: { id: true, firstName: true, lastName: true } } },
      }),
      this.prisma.blacklistEntry.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async addEntry(tenantId: string, blacklistId: string, userId: string, dto: AddEntryDto) {
    await this.findOne(tenantId, blacklistId);
    const phone = this.normalizePhone(dto.phone);

    const existing = await this.prisma.blacklistEntry.findUnique({
      where: { blacklistId_phone: { blacklistId, phone } },
    });
    if (existing?.isActive) throw new ConflictException('Numéro déjà blacklisté');

    if (existing) {
      return this.prisma.blacklistEntry.update({
        where: { id: existing.id },
        data: { isActive: true, reason: dto.reason ?? null, addedById: userId },
      });
    }

    return this.prisma.blacklistEntry.create({
      data: { blacklistId, tenantId, phone, addedById: userId, reason: dto.reason ?? null },
    });
  }

  async bulkAddEntries(
    tenantId: string, blacklistId: string, userId: string, dto: BulkAddEntriesDto,
  ) {
    await this.findOne(tenantId, blacklistId);
    const phones = [...new Set(dto.phones.map((p) => this.normalizePhone(p)))];

    const existing = new Set(
      (await this.prisma.blacklistEntry.findMany({
        where: { blacklistId, phone: { in: phones } },
        select: { phone: true },
      })).map((e) => e.phone),
    );

    const toCreate = phones
      .filter((p) => !existing.has(p))
      .map((phone) => ({ blacklistId, tenantId, phone, addedById: userId, reason: dto.reason ?? null }));

    await this.prisma.blacklistEntry.createMany({ data: toCreate, skipDuplicates: true });
    return { added: toCreate.length, skipped: phones.length - toCreate.length };
  }

  async removeEntry(tenantId: string, entryId: string) {
    const entry = await this.prisma.blacklistEntry.findFirst({ where: { id: entryId, tenantId } });
    if (!entry) throw new NotFoundException('Entrée introuvable');
    return this.prisma.blacklistEntry.update({ where: { id: entryId }, data: { isActive: false } });
  }

  /** Check un numéro contre toutes les blacklists actives du tenant (+campagne optionnelle) */
  async checkPhone(tenantId: string, phone: string, campaignId?: string) {
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
      include: { blacklist: { select: { name: true, scope: true } } },
    });
    return {
      blacklisted: !!entry,
      phone: normalized,
      blacklist: entry?.blacklist ?? null,
      reason: entry?.reason ?? null,
    };
  }

  /** Import CSV de numéros dans une blacklist */
  async importCsv(
    tenantId: string, blacklistId: string, userId: string,
    buffer: Buffer, phoneColumn?: string,
  ) {
    await this.findOne(tenantId, blacklistId);
    let rows: Record<string, string>[];
    try {
      rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    } catch {
      rows = parse(buffer, { columns: false, skip_empty_lines: true, trim: true, bom: true })
        .map((r: string[]) => ({ phone: r[0] }));
    }

    const col = phoneColumn ?? Object.keys(rows[0] ?? {})[0] ?? 'phone';
    const phones = rows.map((r) => r[col]).filter(Boolean);
    return this.bulkAddEntries(tenantId, blacklistId, userId, { phones });
  }

  /** Export CSV d'une blacklist */
  async exportCsv(tenantId: string, blacklistId: string): Promise<string> {
    await this.findOne(tenantId, blacklistId);
    const entries = await this.prisma.blacklistEntry.findMany({
      where: { blacklistId, tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    const header = 'Téléphone,Raison,Date ajout';
    const rows = entries.map((e) =>
      `"${e.phone}","${e.reason ?? ''}","${e.createdAt.toISOString()}"`,
    );
    return [header, ...rows].join('\n');
  }

  normalizePhone(phone: string): string {
    return phone.replace(/\s/g, '').replace(/[^\d+]/g, '');
  }
}
