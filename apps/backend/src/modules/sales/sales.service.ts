import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { FilterSaleDto } from './dto/filter-sale.dto';

const SALE_INCLUDE = {
  agent:    { select: { id: true, firstName: true, lastName: true } },
  client:   { select: { id: true, firstName: true, lastName: true, company: true } },
  campaign: { select: { id: true, name: true } },
  call: {
    select: {
      id: true, duration: true, callerNumber: true, calleeNumber: true, startedAt: true,
      recording: { select: { id: true, filePath: true, durationSec: true } },
    },
  },
  logs: {
    orderBy: { createdAt: 'desc' as const },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  },
} as const;

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Filtrage ─────────────────────────────────────────────

  private buildWhere(tenantId: string, dto: FilterSaleDto) {
    const where: any = { tenantId };
    if (dto.agentId)       where.agentId     = dto.agentId;
    if (dto.campaignId)    where.campaignId  = dto.campaignId;
    if (dto.clientId)      where.clientId    = dto.clientId;
    if (dto.status)        where.status      = dto.status;
    if (dto.qualification) where.qualification = dto.qualification;
    if (dto.from || dto.to) {
      where.createdAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to   ? { lte: new Date(dto.to)   } : {}),
      };
    }
    if (dto.minAmount !== undefined || dto.maxAmount !== undefined) {
      where.amount = {
        ...(dto.minAmount !== undefined ? { gte: dto.minAmount } : {}),
        ...(dto.maxAmount !== undefined ? { lte: dto.maxAmount } : {}),
      };
    }
    return where;
  }

  // ── CRUD ─────────────────────────────────────────────────

  async findAll(tenantId: string, dto: FilterSaleDto) {
    const where = this.buildWhere(tenantId, dto);
    const skip  = dto.skip  ?? 0;
    const take  = dto.limit ?? 50;
    const [data, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where, include: SALE_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take,
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { data, meta: { total, skip, take } };
  }

  async findOne(tenantId: string, id: string) {
    const sale = await this.prisma.sale.findFirst({ where: { id, tenantId }, include: SALE_INCLUDE });
    if (!sale) throw new NotFoundException('Vente introuvable');
    return sale;
  }

  async create(tenantId: string, _userId: string, dto: CreateSaleDto) {
    return this.prisma.sale.create({
      data: {
        tenantId,
        agentId:       dto.agentId,
        clientId:      dto.clientId,
        campaignId:    dto.campaignId,
        callId:        dto.callId,
        status:        dto.status ?? 'PENDING',
        amount:        dto.amount,
        qualification: dto.qualification,
        notes:         dto.notes,
        closedAt:      dto.closedAt ? new Date(dto.closedAt) : null,
      },
      include: SALE_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, userId: string, dto: UpdateSaleDto) {
    const current = await this.findOne(tenantId, id);
    const updates = await this.prisma.sale.update({
      where: { id },
      data: {
        ...(dto.status        !== undefined ? { status:        dto.status        } : {}),
        ...(dto.amount        !== undefined ? { amount:        dto.amount        } : {}),
        ...(dto.qualification !== undefined ? { qualification: dto.qualification } : {}),
        ...(dto.notes         !== undefined ? { notes:         dto.notes         } : {}),
        ...(dto.clientId      !== undefined ? { clientId:      dto.clientId      } : {}),
        ...(dto.campaignId    !== undefined ? { campaignId:    dto.campaignId    } : {}),
        ...(dto.callId        !== undefined ? { callId:        dto.callId        } : {}),
        ...(dto.closedAt      !== undefined ? { closedAt:      new Date(dto.closedAt!) } : {}),
      },
      include: SALE_INCLUDE,
    });
    await this.auditChanges(id, userId, current, dto);
    return updates;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.sale.delete({ where: { id } });
  }

  // ── Stats ─────────────────────────────────────────────────

  async stats(tenantId: string, agentId?: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const base: any = { tenantId };
    if (agentId) base.agentId = agentId;
    const [total, confirmed, todayTotal, revenue] = await Promise.all([
      this.prisma.sale.count({ where: base }),
      this.prisma.sale.count({ where: { ...base, status: 'CONFIRMED' } }),
      this.prisma.sale.count({ where: { ...base, createdAt: { gte: today } } }),
      this.prisma.sale.aggregate({ where: { ...base, status: 'CONFIRMED' }, _sum: { amount: true } }),
    ]);
    return {
      total,
      confirmed,
      todayTotal,
      revenue: revenue._sum.amount ?? 0,
      confirmRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
    };
  }

  // ── Audit ─────────────────────────────────────────────────

  private async auditChanges(saleId: string, userId: string, before: any, after: Partial<UpdateSaleDto>) {
    const tracked: (keyof UpdateSaleDto)[] = ['status', 'amount', 'qualification', 'notes', 'clientId', 'campaignId'];
    const logs = tracked
      .filter((f) => after[f] !== undefined && String(before[f]) !== String(after[f]))
      .map((field) => ({ saleId, userId, field, oldValue: String(before[field] ?? ''), newValue: String(after[field]) }));
    if (logs.length) await this.prisma.saleLog.createMany({ data: logs });
  }
}
