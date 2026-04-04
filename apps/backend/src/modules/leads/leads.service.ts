import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { parse } from 'csv-parse/sync';

const LEAD_SELECT = {
  id: true, firstName: true, lastName: true, email: true, phone: true,
  company: true, status: true, notes: true, campaignId: true, createdAt: true,
  campaign: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, firstName: true, lastName: true } },
} as const;

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, params: { campaignId?: string; status?: string; limit?: number; skip?: number }) {
    const { campaignId, status, limit = 50, skip = 0 } = params;
    const where = {
      tenantId,
      ...(campaignId ? { campaignId } : {}),
      ...(status ? { status: status as any } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.lead.findMany({ where, select: LEAD_SELECT, orderBy: { createdAt: 'desc' }, take: limit, skip }),
      this.prisma.lead.count({ where }),
    ]);
    return { data, meta: { total, limit, skip } };
  }

  async findOne(tenantId: string, id: string) {
    const lead = await this.prisma.lead.findFirst({ where: { id, tenantId }, select: LEAD_SELECT });
    if (!lead) throw new NotFoundException('Lead introuvable');
    return lead;
  }

  async create(tenantId: string, dto: CreateLeadDto) {
    return this.prisma.lead.create({ data: { tenantId, ...dto }, select: LEAD_SELECT });
  }

  async update(tenantId: string, id: string, dto: UpdateLeadDto) {
    await this.findOne(tenantId, id);
    return this.prisma.lead.update({ where: { id }, data: dto, select: LEAD_SELECT });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.lead.delete({ where: { id } });
  }

  async importCsv(tenantId: string, campaignId: string, buffer: Buffer): Promise<{ created: number; errors: string[] }> {
    let rows: any[];
    try {
      rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
    } catch {
      throw new BadRequestException('Fichier CSV invalide');
    }

    const errors: string[] = [];
    const data: any[] = [];

    rows.forEach((row, i) => {
      const firstName = row.firstName || row.first_name || row.prenom || row.prénom;
      const lastName  = row.lastName  || row.last_name  || row.nom;
      const email     = row.email     || row.Email;
      const phone     = row.phone     || row.telephone  || row.téléphone;
      const company   = row.company   || row.entreprise || row.société;

      if (!firstName || !lastName) { errors.push(`Ligne ${i + 2} : prénom/nom manquant`); return; }

      data.push({ tenantId, campaignId, firstName, lastName, email, phone, company, status: 'NEW' });
    });

    if (data.length > 0) {
      await this.prisma.lead.createMany({ data, skipDuplicates: false });
    }

    return { created: data.length, errors };
  }
}
