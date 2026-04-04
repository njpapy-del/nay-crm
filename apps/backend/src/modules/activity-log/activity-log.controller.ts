import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('activity-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActivityLogController {
  constructor(private readonly service: ActivityLogService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  findAll(
    @CurrentUser() user: any,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll(user.tenantId, {
      userId, module, action, dateFrom, dateTo,
      page: page ? +page : 1,
      limit: limit ? +limit : 50,
    });
  }

  @Get('modules')
  @Roles('ADMIN', 'MANAGER')
  getModules(@CurrentUser() user: any) {
    return this.service.getModules(user.tenantId);
  }
}
