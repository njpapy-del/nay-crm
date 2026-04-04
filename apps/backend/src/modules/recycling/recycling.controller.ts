import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { RecyclingService, FilterRecyclingDto, ScheduleRecallDto } from './recycling.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('recycling')
@UseGuards(JwtAuthGuard)
export class RecyclingController {
  constructor(private readonly service: RecyclingService) {}

  @Get()
  getToRecycle(@CurrentUser() user: any, @Query() filters: FilterRecyclingDto) {
    return this.service.getToRecycle(user.tenantId, filters);
  }

  @Get('logs')
  getLogs(@CurrentUser() user: any, @Query() filters: FilterRecyclingDto) {
    return this.service.getLogs(user.tenantId, filters);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.service.getStats(user.tenantId);
  }

  @Post('recall')
  scheduleRecall(@CurrentUser() user: any, @Body() dto: ScheduleRecallDto) {
    return this.service.scheduleRecall(user.tenantId, user.id, dto);
  }
}
