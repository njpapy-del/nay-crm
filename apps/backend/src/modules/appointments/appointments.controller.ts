import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentStatusDto } from './dto/create-appointment.dto';
import { ReviewScoreDto } from '../campaign-criteria/dto/upsert-criteria.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('appointments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Get('kpi')
  @Roles('ADMIN', 'MANAGER', 'QUALITY')
  getKpi(
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    return this.service.getKpi(user.tenantId, { from, to, agentId, campaignId });
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  findAll(
    @CurrentUser() user: any,
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(user.tenantId, { agentId, campaignId, from, to, status });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  create(@CurrentUser() user: any, @Body() dto: CreateAppointmentDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: Partial<CreateAppointmentDto>) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  updateStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAppointmentStatusDto) {
    return this.service.updateStatus(user.tenantId, id, dto);
  }

  @Post(':id/score/recalc')
  @Roles('ADMIN', 'MANAGER', 'QUALITY')
  recalcScore(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.recalcScore(user.tenantId, id);
  }

  @Patch(':id/score/review')
  @Roles('ADMIN', 'MANAGER', 'QUALITY')
  reviewScore(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewScoreDto) {
    return this.service.reviewScore(user.tenantId, id, dto, user.id);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }
}
