import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { QualityGridService } from './quality-grid.service';
import { CreateQualityGridDto, UpdateQualityGridDto } from './dto/quality-grid.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('quality-grids')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityGridController {
  constructor(private readonly svc: QualityGridService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR')
  findAll(@CurrentUser() user: any, @Query('campaignId') campaignId?: string) {
    return this.svc.findAll(user.tenantId, campaignId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'QUALITY_SUPERVISOR')
  create(@CurrentUser() user: any, @Body() dto: CreateQualityGridDto) {
    return this.svc.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'QUALITY_SUPERVISOR')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateQualityGridDto) {
    return this.svc.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER', 'QUALITY_SUPERVISOR')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.remove(user.tenantId, id);
  }
}
