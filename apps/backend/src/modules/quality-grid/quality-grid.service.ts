import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateQualityGridDto, UpdateQualityGridDto } from './dto/quality-grid.dto';

const GRID_INCLUDE = {
  items: { orderBy: { position: 'asc' as const } },
  campaign: { select: { id: true, name: true } },
};

@Injectable()
export class QualityGridService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, campaignId?: string) {
    const where: any = { tenantId };
    if (campaignId) where.campaignId = campaignId;
    const grids = await this.prisma.qualityGrid.findMany({
      where,
      include: GRID_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return { data: grids };
  }

  async findOne(tenantId: string, id: string) {
    const grid = await this.prisma.qualityGrid.findFirst({
      where: { id, tenantId },
      include: GRID_INCLUDE,
    });
    if (!grid) throw new NotFoundException('Grille introuvable');
    return { data: grid };
  }

  async create(tenantId: string, dto: CreateQualityGridDto) {
    const { items = [], ...rest } = dto;
    const grid = await this.prisma.qualityGrid.create({
      data: {
        ...rest,
        tenantId,
        items: {
          create: items.map((item, idx) => ({
            name: item.name,
            weight: item.weight ?? 1.0,
            maxScore: item.maxScore ?? 5,
            isRequired: item.isRequired ?? false,
            position: item.position ?? idx,
          })),
        },
      },
      include: GRID_INCLUDE,
    });
    return { data: grid };
  }

  async update(tenantId: string, id: string, dto: UpdateQualityGridDto) {
    await this.assertOwner(tenantId, id);
    const { items, ...rest } = dto;

    if (items !== undefined) {
      await this.prisma.qualityGridItem.deleteMany({ where: { gridId: id } });
      await this.prisma.qualityGridItem.createMany({
        data: items.map((item, idx) => ({
          gridId: id,
          name: item.name,
          weight: item.weight ?? 1.0,
          maxScore: item.maxScore ?? 5,
          isRequired: item.isRequired ?? false,
          position: item.position ?? idx,
        })),
      });
    }

    const grid = await this.prisma.qualityGrid.update({
      where: { id },
      data: rest,
      include: GRID_INCLUDE,
    });
    return { data: grid };
  }

  async remove(tenantId: string, id: string) {
    await this.assertOwner(tenantId, id);
    await this.prisma.qualityGrid.delete({ where: { id } });
    return { ok: true };
  }

  private async assertOwner(tenantId: string, id: string) {
    const g = await this.prisma.qualityGrid.findFirst({ where: { id, tenantId } });
    if (!g) throw new NotFoundException('Grille introuvable');
  }
}
