import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  private _dates(dateFrom?: string, dateTo?: string) {
    const from = dateFrom ? new Date(dateFrom) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const to = dateTo ? new Date(dateTo) : new Date();
    return { from, to };
  }

  @Get('dashboard')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  dashboard(@CurrentUser() u: any, @Query('dateFrom') df?: string, @Query('dateTo') dt?: string) {
    const { from, to } = this._dates(df, dt);
    return this.service.getDashboard(u.tenantId, from, to);
  }

  @Get('qualifications')
  @Roles('ADMIN', 'MANAGER')
  qualif(
    @CurrentUser() u: any,
    @Query('dateFrom') df?: string, @Query('dateTo') dt?: string, @Query('campaignId') cid?: string,
  ) {
    const { from, to } = this._dates(df, dt);
    return this.service.callsByQualification(u.tenantId, from, to, cid);
  }

  @Get('calls-by-hour')
  @Roles('ADMIN', 'MANAGER')
  callsByHour(@CurrentUser() u: any, @Query('dateFrom') df?: string, @Query('dateTo') dt?: string) {
    const { from, to } = this._dates(df, dt);
    return this.service.callsByHour(u.tenantId, from, to);
  }

  @Get('by-campaign')
  @Roles('ADMIN', 'MANAGER')
  byCampaign(@CurrentUser() u: any, @Query('dateFrom') df?: string, @Query('dateTo') dt?: string) {
    const { from, to } = this._dates(df, dt);
    return this.service.byCampaign(u.tenantId, from, to);
  }

  @Get('revenue')
  @Roles('ADMIN', 'MANAGER')
  revenue(@CurrentUser() u: any, @Query('dateFrom') df?: string, @Query('dateTo') dt?: string) {
    const { from, to } = this._dates(df, dt);
    return this.service.revenueTimeSeries(u.tenantId, from, to);
  }

  @Get('realtime')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  realtime(@CurrentUser() u: any) {
    return this.service.getRealtime(u.tenantId);
  }
}
