import { Controller, Get, Post, Body, Query, UseGuards, Delete, Param, Patch } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('kpi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(
    private readonly kpiService: KpiService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR')
  async getKpi(
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : this._startOfMonth();
    const to = dateTo ? new Date(dateTo) : new Date();
    const kpi = await this.kpiService.compute({ tenantId: user.tenantId, agentId, campaignId, dateFrom: from, dateTo: to });
    const alerts = await this.kpiService.checkAlerts(user.tenantId, kpi);
    return { kpi, alerts };
  }

  @Get('by-agent')
  @Roles('ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR')
  async byAgent(
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('campaignId') campaignId?: string,
  ) {
    const from = dateFrom ? new Date(dateFrom) : this._startOfMonth();
    const to = dateTo ? new Date(dateTo) : new Date();
    return this.kpiService.byAgent(user.tenantId, from, to, campaignId);
  }

  @Get('timeseries')
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR')
  async timeSeries(
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('agentId') agentId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('granularity') granularity: 'day' | 'week' | 'month' = 'day',
  ) {
    const from = dateFrom ? new Date(dateFrom) : this._startOfMonth();
    const to = dateTo ? new Date(dateTo) : new Date();
    return this.kpiService.timeSeries({ tenantId: user.tenantId, agentId, campaignId, dateFrom: from, dateTo: to }, granularity);
  }

  @Get('alerts')
  @Roles('ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR')
  getAlerts(@CurrentUser() user: any) {
    return this.prisma.alertRule.findMany({ where: { tenantId: user.tenantId }, orderBy: { createdAt: 'desc' } });
  }

  @Post('alerts')
  @Roles('ADMIN', 'MANAGER')
  createAlert(@CurrentUser() user: any, @Body() body: {
    name: string; metric: string; operator: string; threshold: number; agentId?: string; campaignId?: string;
  }) {
    return this.prisma.alertRule.create({ data: { tenantId: user.tenantId, ...body } });
  }

  @Patch('alerts/:id')
  @Roles('ADMIN', 'MANAGER')
  updateAlert(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.prisma.alertRule.updateMany({ where: { id, tenantId: user.tenantId }, data: body });
  }

  @Delete('alerts/:id')
  @Roles('ADMIN', 'MANAGER')
  deleteAlert(@CurrentUser() user: any, @Param('id') id: string) {
    return this.prisma.alertRule.deleteMany({ where: { id, tenantId: user.tenantId } });
  }

  @Post('aggregate')
  @Roles('ADMIN')
  async triggerAggregate() {
    await this.kpiService.aggregateDaily();
    return { message: 'Agrégation terminée' };
  }

  private _startOfMonth(): Date {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    return d;
  }
}
