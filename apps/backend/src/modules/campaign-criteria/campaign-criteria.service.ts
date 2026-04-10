import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCriteriaDto } from './dto/upsert-criteria.dto';

@Injectable()
export class CampaignCriteriaService {
  constructor(private readonly prisma: PrismaService) {}

  async findByCampaign(tenantId: string, campaignId: string) {
    const criteria = await this.prisma.campaignCriteria.findUnique({
      where: { campaignId },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
    if (criteria && criteria.tenantId !== tenantId) throw new NotFoundException();
    return criteria;
  }

  async upsert(tenantId: string, campaignId: string, dto: UpsertCriteriaDto) {
    const existing = await this.prisma.campaignCriteria.findUnique({ where: { campaignId } });

    if (existing) {
      // Supprimer les anciens champs puis recréer (plus simple que diff)
      await this.prisma.campaignCriteriaField.deleteMany({ where: { criteriaId: existing.id } });
      return this.prisma.campaignCriteria.update({
        where: { id: existing.id },
        data: {
          name: dto.name ?? existing.name,
          description: dto.description,
          minScoreOk: dto.minScoreOk ?? existing.minScoreOk,
          fields: {
            create: (dto.fields ?? []).map((f, i) => ({
              label: f.label, key: f.key, type: f.type,
              required: f.required ?? false, weight: f.weight ?? 1,
              position: f.position ?? i,
              options: f.options ? (f.options as any) : undefined,
              validation: f.validation ? (f.validation as any) : undefined,
            })),
          },
        },
        include: { fields: { orderBy: { position: 'asc' } } },
      });
    }

    return this.prisma.campaignCriteria.create({
      data: {
        tenantId,
        campaignId,
        name: dto.name ?? 'Critères de qualification',
        description: dto.description,
        minScoreOk: dto.minScoreOk ?? 70,
        fields: {
          create: (dto.fields ?? []).map((f, i) => ({
            label: f.label, key: f.key, type: f.type,
            required: f.required ?? false, weight: f.weight ?? 1,
            position: f.position ?? i,
            options: f.options ? (f.options as any) : undefined,
            validation: f.validation ? (f.validation as any) : undefined,
          })),
        },
      },
      include: { fields: { orderBy: { position: 'asc' } } },
    });
  }

  async remove(tenantId: string, campaignId: string) {
    const criteria = await this.prisma.campaignCriteria.findUnique({ where: { campaignId } });
    if (!criteria || criteria.tenantId !== tenantId) throw new NotFoundException();
    await this.prisma.campaignCriteria.delete({ where: { id: criteria.id } });
  }
}
