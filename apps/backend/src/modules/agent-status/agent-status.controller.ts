import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AgentStatusService } from './agent-status.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChangeStatusDto, GetStatusHistoryDto } from './dto/change-status.dto';

@Controller('agent-status')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentStatusController {
  constructor(private readonly svc: AgentStatusService) {}

  // ── Agent routes ─────────────────────────────────────────────

  @Post('change')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  change(@CurrentUser() user: any, @Body() dto: ChangeStatusDto) {
    return this.svc.changeStatus(user.tenantId, user.sub, dto.status, dto.notes);
  }

  @Get('current')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  current(@CurrentUser() user: any) {
    return this.svc.getCurrent(user.sub);
  }

  @Get('history')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  history(@CurrentUser() user: any, @Query() dto: GetStatusHistoryDto) {
    const agentId = user.role === 'AGENT' ? user.sub : (dto.agentId ?? user.sub);
    const from = dto.from ? new Date(dto.from) : undefined;
    const to   = dto.to   ? new Date(dto.to)   : undefined;
    return this.svc.getHistory(user.tenantId, agentId, from, to);
  }

  @Get('breakdown')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  breakdown(@CurrentUser() user: any, @Query() dto: GetStatusHistoryDto) {
    const agentId = user.role === 'AGENT' ? user.sub : (dto.agentId ?? user.sub);
    const from = dto.from ? new Date(dto.from) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    const to   = dto.to   ? new Date(dto.to)   : new Date();
    return this.svc.getTimeBreakdown(user.tenantId, agentId, from, to);
  }

  // ── Manager routes ────────────────────────────────────────────

  @Get('team-snapshot')
  @Roles('MANAGER', 'ADMIN')
  teamSnapshot(@CurrentUser() user: any) {
    return this.svc.getTeamSnapshot(user.tenantId);
  }

  @Get('team-breakdown')
  @Roles('MANAGER', 'ADMIN')
  teamBreakdown(@CurrentUser() user: any) {
    return this.svc.getTeamBreakdownToday(user.tenantId);
  }
}
