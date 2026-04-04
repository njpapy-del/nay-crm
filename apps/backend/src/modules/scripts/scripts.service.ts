import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateScriptDto, UpdateScriptDto } from './scripts.dto';
import { paginationParams } from '../../common/dto/pagination.dto';

@Injectable()
export class ScriptsService {
  constructor(private prisma: PrismaService) {}

  // ── List ───────────────────────────────────────────────────────────────────

  async findAll(tenantId: string, query: any) {
    const { skip, take } = paginationParams(query);
    const where: any = { tenantId };
    if (query.campaignId) where.campaignId = query.campaignId;
    if (query.isActive !== undefined) where.isActive = query.isActive === 'true';

    const [data, total] = await Promise.all([
      this.prisma.script.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          campaign: { select: { id: true, name: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          _count: { select: { fields: true, responses: true } },
        },
      }),
      this.prisma.script.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: take };
  }

  // ── Find one ───────────────────────────────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const script = await this.prisma.script.findFirst({
      where: { id, tenantId },
      include: {
        campaign: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        fields: { orderBy: { order: 'asc' } },
      },
    });
    if (!script) throw new NotFoundException('Script introuvable');
    return script;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(tenantId: string, userId: string, dto: CreateScriptDto) {
    return this.prisma.script.create({
      data: { ...dto, tenantId, createdById: userId },
      include: { campaign: { select: { id: true, name: true } } },
    });
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(tenantId: string, id: string, dto: UpdateScriptDto) {
    await this._assertExists(tenantId, id);
    return this.prisma.script.update({
      where: { id },
      data: dto,
      include: { campaign: { select: { id: true, name: true } } },
    });
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async remove(tenantId: string, id: string) {
    await this._assertExists(tenantId, id);
    await this.prisma.script.delete({ where: { id } });
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────

  async exportCsv(tenantId: string, scriptId: string): Promise<string> {
    const script = await this.findOne(tenantId, scriptId);
    const responses = await this.prisma.scriptResponse.findMany({
      where: { scriptId, tenantId },
      include: { values: { include: { field: true } }, agent: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    const headers = ['Date', 'Agent', 'Appel', 'Contact', 'Complet',
      ...script.fields.map(f => f.label)];

    const rows = responses.map(r => {
      const valMap = Object.fromEntries(r.values.map(v => [v.fieldId, v.value]));
      return [
        r.createdAt.toISOString(),
        `${r.agent.firstName} ${r.agent.lastName}`,
        r.callId ?? '',
        r.contactId ?? '',
        r.isComplete ? 'oui' : 'non',
        ...script.fields.map(f => {
          const v = valMap[f.id];
          if (v === null || v === undefined) return '';
          if (Array.isArray(v)) return (v as string[]).join(', ');
          return String(v);
        }),
      ];
    });

    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async _assertExists(tenantId: string, id: string) {
    const s = await this.prisma.script.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException('Script introuvable');
    return s;
  }
}
