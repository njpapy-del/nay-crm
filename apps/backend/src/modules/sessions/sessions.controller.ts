import { Controller, Get, Delete, Param, UseGuards } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('sessions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SessionsController {
  constructor(private readonly service: SessionsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  getActive(@CurrentUser() user: any) {
    return this.service.getActiveSessions(user.tenantId);
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER')
  getStats(@CurrentUser() user: any) {
    return this.service.getStats(user.tenantId);
  }

  @Delete(':sessionId')
  @Roles('ADMIN')
  forceLogout(@CurrentUser() user: any, @Param('sessionId') sessionId: string) {
    return this.service.forceLogout(user.tenantId, sessionId);
  }

  @Delete('user/:userId')
  @Roles('ADMIN')
  forceLogoutUser(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.service.forceLogoutUser(user.tenantId, userId);
  }
}
