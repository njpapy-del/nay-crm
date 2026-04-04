import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Res, UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportingService, ReportConfig } from './reporting.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reporting')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  // ─── Dashboard summary ────────────────────────────────────────────────────

  @Get('summary')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  summary(@CurrentUser() u: any) {
    return this.service.getDashboardSummary(u.tenantId);
  }

  // ─── Rapports sauvegardés ─────────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'MANAGER')
  findAll(@CurrentUser() u: any) {
    return this.service.findAll(u.tenantId);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  save(@CurrentUser() u: any, @Body() body: { name: string; config: ReportConfig; description?: string }) {
    return this.service.save(u.tenantId, u.sub, body.name, body.config, body.description);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { name?: string; config?: ReportConfig }) {
    return this.service.update(u.tenantId, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() u: any, @Param('id') id: string) {
    return this.service.remove(u.tenantId, id);
  }

  // ─── Exécuter un rapport ──────────────────────────────────────────────────

  @Post('run')
  @Roles('ADMIN', 'MANAGER')
  run(@CurrentUser() u: any, @Body() config: ReportConfig) {
    return this.service.run(u.tenantId, config);
  }

  // ─── Exports ─────────────────────────────────────────────────────────────

  @Post('export/csv')
  @Roles('ADMIN', 'MANAGER')
  async exportCsv(@CurrentUser() u: any, @Body() config: ReportConfig, @Res() res: Response) {
    const buf = await this.service.exportCsv(u.tenantId, config);
    const filename = `rapport-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  @Post('export/xlsx')
  @Roles('ADMIN', 'MANAGER')
  async exportXlsx(@CurrentUser() u: any, @Body() body: { config: ReportConfig; name?: string }, @Res() res: Response) {
    const buf = await this.service.exportXlsx(u.tenantId, body.config, body.name);
    const filename = `rapport-${new Date().toISOString().split('T')[0]}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  }

  @Get('export/csv')
  @Roles('ADMIN', 'MANAGER')
  async exportCsvGet(
    @CurrentUser() u: any,
    @Query('dateFrom') dateFrom: string, @Query('dateTo') dateTo: string,
    @Query('agentId') agentId: string, @Query('campaignId') campaignId: string,
    @Res() res: Response,
  ) {
    const config: ReportConfig = { dateFrom, dateTo, agentId, campaignId, metrics: [] };
    const buf = await this.service.exportCsv(u.tenantId, config);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rapport.csv"');
    res.send(buf);
  }
}
