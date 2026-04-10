import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { CampaignCriteriaService } from './campaign-criteria.service';
import { UpsertCriteriaDto } from './dto/upsert-criteria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('campaigns/:campaignId/criteria')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignCriteriaController {
  constructor(private readonly service: CampaignCriteriaService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  findOne(@CurrentUser() user: any, @Param('campaignId') campaignId: string) {
    return this.service.findByCampaign(user.tenantId, campaignId);
  }

  @Put()
  @Roles('ADMIN', 'MANAGER')
  upsert(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: UpsertCriteriaDto,
  ) {
    return this.service.upsert(user.tenantId, campaignId, dto);
  }

  @Delete()
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('campaignId') campaignId: string) {
    return this.service.remove(user.tenantId, campaignId);
  }
}
