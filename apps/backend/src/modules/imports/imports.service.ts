import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { parse } from 'csv-parse/sync';
import { ColumnMapDto, FilterHistoryDto } from './dto/import.dto';

type ParsedRow = Record<string, string>;

export interface ImportResult {
  importedRows: number;
  skippedRows: number;
  errorRows: number;
  duplicates: number;
  errors: { row: number; message: string }[];
}

@Injectable()
export class ImportsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Parse CSV buffer → array of raw rows */
  parseBuffer(buffer: Buffer): ParsedRow[] {
    try {
      return parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }) as ParsedRow[];
    } catch {
      throw new BadRequestException('Fichier CSV invalide');
    }
  }

  /** Extract headers from CSV buffer (pour le mapping UI) */
  getHeaders(buffer: Buffer): string[] {
    const rows = parse(buffer, {
      columns: true, to: 1, skip_empty_lines: true, trim: true, bom: true,
    }) as ParsedRow[];
    return rows.length > 0 ? Object.keys(rows[0]) : [];
  }

  /** Normalize phone: remove spaces, keep +prefix */
  normalizePhone(raw: string): string {
    return raw.replace(/\s/g, '').replace(/[^\d+]/g, '');
  }

  /** Validate phone format — minimum 8 digits */
  isValidPhone(phone: string): boolean {
    return /^\+?\d{8,15}$/.test(phone);
  }

  /** Map raw CSV row to Contact fields using ColumnMapDto */
  private mapRow(raw: ParsedRow, colMap: ColumnMapDto): Partial<Record<string, any>> | null {
    const rawPhone = raw[colMap.phone] ?? '';
    if (!rawPhone) return null;
    const phone = this.normalizePhone(rawPhone);
    if (!this.isValidPhone(phone)) return null;

    return {
      phone,
      firstName: colMap.firstName ? (raw[colMap.firstName] ?? '').trim() || null : null,
      lastName:  colMap.lastName  ? (raw[colMap.lastName]  ?? '').trim() || null : null,
      email:     colMap.email     ? (raw[colMap.email]     ?? '').trim() || null : null,
      company:   colMap.company   ? (raw[colMap.company]   ?? '').trim() || null : null,
      notes:     colMap.notes     ? (raw[colMap.notes]     ?? '').trim() || null : null,
    };
  }

  /** Preview first N rows without persisting */
  previewRows(buffer: Buffer, colMap: ColumnMapDto, maxRows = 5) {
    const rows = this.parseBuffer(buffer).slice(0, maxRows);
    return rows.map((raw, i) => ({ row: i + 1, ...this.mapRow(raw, colMap) }));
  }

  /** Full import: parse, validate, deduplicate, persist */
  async importCsv(
    tenantId: string,
    userId: string,
    listId: string,
    buffer: Buffer,
    fileName: string,
    colMap: ColumnMapDto,
  ): Promise<ImportResult> {
    const list = await this.prisma.contactList.findFirst({ where: { id: listId, tenantId } });
    if (!list) throw new NotFoundException('Liste introuvable');

    const historyEntry = await this.prisma.importHistory.create({
      data: { tenantId, listId, createdById: userId, fileName, columnMap: colMap as any, status: 'PROCESSING', startedAt: new Date() },
    });

    const rows = this.parseBuffer(buffer);
    const result: ImportResult = { importedRows: 0, skippedRows: 0, errorRows: 0, duplicates: 0, errors: [] };

    // Existing phones in this list
    const existingPhones = new Set(
      (await this.prisma.contact.findMany({ where: { listId }, select: { phone: true } }))
        .map((c) => c.phone),
    );

    // Blacklisted phones for this tenant
    const blacklisted = new Set(
      (await this.prisma.blacklistEntry.findMany({
        where: { tenantId, isActive: true },
        select: { phone: true },
      })).map((e) => e.phone),
    );

    const toInsert: any[] = [];
    const seenInBatch = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const mapped = this.mapRow(rows[i], colMap);
      if (!mapped || !mapped.phone) {
        result.errorRows++;
        result.errors.push({ row: i + 2, message: 'Téléphone manquant ou invalide' });
        continue;
      }
      const phone = mapped.phone as string;

      if (existingPhones.has(phone) || seenInBatch.has(phone)) {
        result.duplicates++;
        result.skippedRows++;
        continue;
      }

      seenInBatch.add(phone);
      toInsert.push({
        tenantId,
        listId,
        phone,
        firstName: mapped.firstName,
        lastName:  mapped.lastName,
        email:     mapped.email,
        company:   mapped.company,
        notes:     mapped.notes,
        isBlacklisted: blacklisted.has(phone),
      });
    }

    if (toInsert.length > 0) {
      await this.prisma.contact.createMany({ data: toInsert, skipDuplicates: true });
      result.importedRows = toInsert.length;
    }

    const total = await this.prisma.contact.count({ where: { listId } });
    await this.prisma.contactList.update({ where: { id: listId }, data: { totalContacts: total } });

    await this.prisma.importHistory.update({
      where: { id: historyEntry.id },
      data: {
        status: 'COMPLETED',
        totalRows: rows.length,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        errorRows: result.errorRows,
        duplicates: result.duplicates,
        errors: result.errors as any,
        completedAt: new Date(),
      },
    });

    return result;
  }

  async getHistory(tenantId: string, filters: FilterHistoryDto) {
    const { listId, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (listId) where.listId = listId;

    const [data, total] = await Promise.all([
      this.prisma.importHistory.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          list: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.importHistory.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getImport(tenantId: string, id: string) {
    const imp = await this.prisma.importHistory.findFirst({
      where: { id, tenantId },
      include: {
        list: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!imp) throw new NotFoundException('Import introuvable');
    return imp;
  }
}
