import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { CampaignNumbersService } from './campaign-numbers.service';
import { AddNumberDto, UpdateNumberDto, SetRotationDto } from './dto/campaign-number.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('campaigns/:campaignId/numbers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class CampaignNumbersController {
  constructor(private readonly svc: CampaignNumbersService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Param('campaignId') campaignId: string) {
    return this.svc.findAll(user.tenantId, campaignId);
  }

  @Post()
  add(@CurrentUser() user: any, @Param('campaignId') campaignId: string, @Body() dto: AddNumberDto) {
    return this.svc.add(user.tenantId, campaignId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
    @Body() dto: UpdateNumberDto,
  ) {
    return this.svc.update(user.tenantId, campaignId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Param('id') id: string,
  ) {
    return this.svc.remove(user.tenantId, campaignId, id);
  }

  @Patch('rotation/mode')
  setRotation(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: SetRotationDto,
  ) {
    return this.svc.setRotation(user.tenantId, campaignId, dto);
  }
}
