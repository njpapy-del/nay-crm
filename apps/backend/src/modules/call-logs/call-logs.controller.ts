import {
  Controller, Get, Post, Patch, Param, Query, Body,
  UseGuards, Res, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { CallLogsService } from './call-logs.service';
import { FilterCallLogsDto, UpdateCallLogDto, CreateCallLogDto } from './dto/call-log.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('call-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallLogsController {
  constructor(private readonly service: CallLogsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR')
  findAll(@CurrentUser() user: any, @Query() filters: FilterCallLogsDto) {
    return this.service.findAll(user.tenantId, filters, user.role, user.id);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  getStats(
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.getStats(user.tenantId, dateFrom, dateTo);
  }

  @Get('export')
  @Roles('ADMIN', 'MANAGER')
  async exportCsv(
    @CurrentUser() user: any,
    @Query() filters: FilterCallLogsDto,
    @Res() res: Response,
  ) {
    const csv = await this.service.exportCsv(user.tenantId, filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="call-logs.csv"');
    res.status(HttpStatus.OK).send('\uFEFF' + csv);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  create(@CurrentUser() user: any, @Body() dto: CreateCallLogDto) {
    return this.service.create(user.tenantId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCallLogDto,
  ) {
    return this.service.update(user.tenantId, id, dto);
  }
}
