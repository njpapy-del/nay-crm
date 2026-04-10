import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { HrService } from './hr.service';
import { CreateHrRequestDto, ReviewHrRequestDto, HrRequestQueryDto, AttendanceQueryDto } from './dto/hr.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const HR_ROLES = ['ADMIN', 'MANAGER', 'HR'] as const;
const ALL_ROLES = ['ADMIN', 'MANAGER', 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR', 'HR'] as const;

@Controller('hr')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HrController {
  constructor(private readonly svc: HrService) {}

  // ── Dashboard & Agenda (avant routes paramétrées) ─────────

  @Get('dashboard')
  @Roles(...HR_ROLES)
  getDashboard(
    @CurrentUser() user: any,
    @Query('from') from: string = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    @Query('to') to: string = new Date().toISOString().slice(0, 10),
  ) {
    return this.svc.getDashboard(user.tenantId, from, to);
  }

  @Get('agenda')
  @Roles(...HR_ROLES, 'AGENT', 'QUALITY', 'QUALITY_SUPERVISOR')
  getAgenda(
    @CurrentUser() user: any,
    @Query('from') from: string = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    @Query('to') to: string = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    @Query('agentId') agentId?: string,
  ) {
    return this.svc.getAgenda(user.tenantId, from, to, agentId);
  }

  // ── Demandes ──────────────────────────────────────────────

  @Post('requests')
  @Roles(...ALL_ROLES)
  createRequest(@CurrentUser() user: any, @Body() dto: CreateHrRequestDto) {
    return this.svc.createRequest(user.tenantId, user.id, dto);
  }

  @Get('requests')
  @Roles(...ALL_ROLES)
  findRequests(
    @CurrentUser() user: any,
    @Query() q: HrRequestQueryDto,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    // Agents voient seulement leurs demandes
    const isManager = ['ADMIN', 'MANAGER', 'HR'].includes(user.role);
    const query = isManager ? q : { ...q, agentId: user.id };
    return this.svc.findRequests(user.tenantId, query, skip ? +skip : 0, limit ? +limit : 20);
  }

  @Patch('requests/:id/review')
  @Roles(...HR_ROLES)
  reviewRequest(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewHrRequestDto) {
    return this.svc.reviewRequest(user.tenantId, id, user.id, dto);
  }

  @Delete('requests/:id')
  @Roles(...ALL_ROLES)
  deleteRequest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deleteRequest(user.tenantId, id, user.id);
  }

  // ── Présence ──────────────────────────────────────────────

  @Get('attendance')
  @Roles(...HR_ROLES)
  getAttendance(@CurrentUser() user: any, @Query() q: AttendanceQueryDto) {
    return this.svc.getAttendance(user.tenantId, q);
  }
}
