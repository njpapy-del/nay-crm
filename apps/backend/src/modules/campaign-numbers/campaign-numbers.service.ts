import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AddNumberDto, UpdateNumberDto, SetRotationDto } from './dto/campaign-number.dto';

@Injectable()
export class CampaignNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, campaignId: string) {
    await this.assertCampaign(tenantId, campaignId);
    const numbers = await this.prisma.campaignNumber.findMany({
      where: { tenantId, campaignId },
      orderBy: [{ isActive: 'desc' }, { position: 'asc' }],
    });
    return { data: numbers };
  }

  async add(tenantId: string, campaignId: string, dto: AddNumberDto) {
    await this.assertCampaign(tenantId, campaignId);
    const exists = await this.prisma.campaignNumber.findFirst({
      where: { campaignId, number: dto.number },
    });
    if (exists) throw new ConflictException('Ce numéro existe déjà dans cette campagne');

    // If set as active, deactivate others (mode MANUAL = one active at a time)
    if (dto.isActive) {
      await this.prisma.campaignNumber.updateMany({
        where: { campaignId },
        data: { isActive: false },
      });
    }

    const num = await this.prisma.campaignNumber.create({
      data: { tenantId, campaignId, ...dto },
    });
    return { data: num };
  }

  async update(tenantId: string, campaignId: string, id: string, dto: UpdateNumberDto) {
    await this.assertNumber(tenantId, campaignId, id);

    if (dto.isActive === true) {
      await this.prisma.campaignNumber.updateMany({
        where: { campaignId, id: { not: id } },
        data: { isActive: false },
      });
    }

    const num = await this.prisma.campaignNumber.update({ where: { id }, data: dto });
    return { data: num };
  }

  async remove(tenantId: string, campaignId: string, id: string) {
    await this.assertNumber(tenantId, campaignId, id);
    await this.prisma.campaignNumber.delete({ where: { id } });
    return { ok: true };
  }

  async setRotation(tenantId: string, campaignId: string, dto: SetRotationDto) {
    await this.assertCampaign(tenantId, campaignId);
    const campaign = await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { callerIdRotation: dto.rotationMode },
    });
    return { data: { callerIdRotation: campaign.callerIdRotation } };
  }

  private async assertCampaign(tenantId: string, campaignId: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id: campaignId, tenantId } });
    if (!c) throw new NotFoundException('Campagne introuvable');
  }

  private async assertNumber(tenantId: string, campaignId: string, id: string) {
    const n = await this.prisma.campaignNumber.findFirst({ where: { id, tenantId, campaignId } });
    if (!n) throw new NotFoundException('Numéro introuvable');
  }
}
