import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

const CAMPAIGN_INCLUDE = {
  createdBy: { select: { id: true, firstName: true, lastName: true } },
  agents: {
    select: {
      agentId: true,
      assignedAt: true,
      agent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  settings: true,
  _count: { select: { leads: true, appointments: true, callLogs: true } },
} as const;

@Injectable()
export class CampaignsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, filters?: {
    status?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const where: any = { tenantId };
    if (filters?.status)   where.status   = filters.status;
    if (filters?.search)   where.name     = { contains: filters.search, mode: 'insensitive' };
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo)   where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59');
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({ where, include: CAMPAIGN_INCLUDE, orderBy: { createdAt: 'desc' } }),
      this.prisma.campaign.count({ where }),
    ]);
    return { data, meta: { total } };
  }

  // ── Recyclage intelligent ─────────────────────────────────────────────────

  async recycleLeads(
    tenantId:   string,
    campaignId: string,
    mode:       'not_reached' | 'failed_calls' | 'all',
  ): Promise<{ recycled: number }> {
    await this.findOne(tenantId, campaignId);

    // not_reached  → CONTACTED (appelés mais pas convertis / non joints)
    // failed_calls → LOST      (définitivement perdus / appels échoués)
    // all          → les deux
    const statusFilter: string[] =
      mode === 'not_reached'  ? ['CONTACTED'] :
      mode === 'failed_calls' ? ['LOST']      :
      ['CONTACTED', 'LOST'];

    const result = await this.prisma.lead.updateMany({
      where: {
        campaignId,
        campaign: { tenantId },
        status:   { in: statusFilter as any[] },
      },
      data: { status: 'NEW' },
    });

    return { recycled: result.count };
  }

  async deduplicateLeads(tenantId: string, campaignId: string): Promise<{ removed: number }> {
    await this.findOne(tenantId, campaignId);

    const leads = await this.prisma.lead.findMany({
      where: { campaignId, campaign: { tenantId } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, phone: true, email: true },
    });

    const seenPhone = new Map<string, string>(); // phone → first lead id
    const seenEmail = new Map<string, string>(); // email → first lead id
    const toDelete  = new Set<string>();

    for (const lead of leads) {
      let isDupe = false;

      if (lead.phone) {
        const normalized = lead.phone.replace(/\s+/g, '');
        if (seenPhone.has(normalized)) {
          isDupe = true;
        } else {
          seenPhone.set(normalized, lead.id);
        }
      }

      if (!isDupe && lead.email) {
        const normalized = lead.email.toLowerCase();
        if (seenEmail.has(normalized)) {
          isDupe = true;
        } else {
          seenEmail.set(normalized, lead.id);
        }
      }

      if (isDupe) toDelete.add(lead.id);
    }

    if (toDelete.size === 0) return { removed: 0 };

    await this.prisma.lead.deleteMany({
      where: { id: { in: [...toDelete] } },
    });

    return { removed: toDelete.size };
  }

  async findOne(tenantId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, tenantId }, include: CAMPAIGN_INCLUDE });
    if (!campaign) throw new NotFoundException('Campagne introuvable');
    return campaign;
  }

  async create(tenantId: string, userId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        tenantId,
        createdById: userId,
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCampaignDto) {
    await this.findOne(tenantId, id);
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: CAMPAIGN_INCLUDE,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.campaign.delete({ where: { id } });
  }

  async assignAgents(tenantId: string, id: string, agentIds: string[]) {
    await this.findOne(tenantId, id);
    const data = agentIds.map((agentId) => ({ campaignId: id, agentId }));
    await this.prisma.campaignAgent.createMany({ data, skipDuplicates: true });
    return this.findOne(tenantId, id);
  }

  async removeAgent(tenantId: string, id: string, agentId: string) {
    await this.findOne(tenantId, id);
    const existing = await this.prisma.campaignAgent.findUnique({
      where: { campaignId_agentId: { campaignId: id, agentId } },
    });
    if (!existing) throw new NotFoundException('Agent non assigné');
    await this.prisma.campaignAgent.delete({ where: { campaignId_agentId: { campaignId: id, agentId } } });
  }

  // ─── Settings ────────────────────────────────────────────────────────────

  async getSettings(tenantId: string, campaignId: string) {
    await this.findOne(tenantId, campaignId);
    const settings = await this.prisma.campaignSettings.findUnique({ where: { campaignId } });
    return settings ?? null;
  }

  async upsertSettings(tenantId: string, campaignId: string, dto: Record<string, any>) {
    await this.findOne(tenantId, campaignId);
    return this.prisma.campaignSettings.upsert({
      where: { campaignId },
      create: { campaignId, ...dto },
      update: dto,
    });
  }

  // ─── Qualifications ───────────────────────────────────────────────────────

  async getQualifications(tenantId: string, campaignId?: string) {
    return this.prisma.qualification.findMany({
      where: { tenantId, ...(campaignId ? { campaignId } : {}) },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });
  }

  async createQualification(tenantId: string, dto: {
    campaignId?: string; label: string; code: string;
    color?: string; isPositive?: boolean; position?: number;
  }) {
    return this.prisma.qualification.create({ data: { tenantId, ...dto } });
  }

  async updateQualification(tenantId: string, qualifId: string, dto: Record<string, any>) {
    const q = await this.prisma.qualification.findFirst({ where: { id: qualifId, tenantId } });
    if (!q) throw new NotFoundException('Qualification introuvable');
    return this.prisma.qualification.update({ where: { id: qualifId }, data: dto });
  }

  async deleteQualification(tenantId: string, qualifId: string) {
    const q = await this.prisma.qualification.findFirst({ where: { id: qualifId, tenantId } });
    if (!q) throw new NotFoundException('Qualification introuvable');
    await this.prisma.qualification.delete({ where: { id: qualifId } });
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  async getStats(tenantId: string, campaignId?: string) {
    const logWhere = { tenantId, ...(campaignId ? { campaignId } : {}) };
    const [total, active, byStatus, callStats] = await Promise.all([
      this.prisma.campaign.count({ where: { tenantId } }),
      this.prisma.campaign.count({ where: { tenantId, status: 'ACTIVE' } }),
      this.prisma.campaign.groupBy({
        by: ['status'], where: { tenantId },
        _count: { id: true }, orderBy: { _count: { id: 'desc' } },
      }),
      this.prisma.callLog.groupBy({
        by: ['qualification'], where: logWhere,
        _count: { id: true }, orderBy: { _count: { id: 'desc' } },
      }),
    ]);
    const byQualif: Record<string, number> = {};
    callStats.forEach((r) => { if (r.qualification) byQualif[r.qualification] = r._count.id; });
    return { total, active, byStatus, byQualification: byQualif };
  }
}
