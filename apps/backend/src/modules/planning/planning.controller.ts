import {
  Controller, Get, Post, Delete, Body, Query, Param, UseGuards,
} from '@nestjs/common';
import { PlanningService } from './planning.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  CreatePlanningDto, CreateRequestDto, ReviewRequestDto, GetPlanningDto,
} from './dto/planning.dto';

const REVIEWER_ROLES = ['MANAGER', 'ADMIN', 'HR'];
const ALL_ROLES = ['MANAGER', 'ADMIN', 'AGENT', 'HR', 'QUALITY', 'QUALITY_SUPERVISOR'];

@Controller('planning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlanningController {
  constructor(private readonly svc: PlanningService) {}

  // ── Events ────────────────────────────────────────────────────

  @Post('events')
  @Roles('MANAGER', 'ADMIN')
  createEvent(@CurrentUser() user: any, @Body() dto: CreatePlanningDto) {
    return this.svc.createEvent(user.tenantId, user.sub, dto);
  }

  @Get('events')
  @Roles(...ALL_ROLES)
  getEvents(@CurrentUser() user: any, @Query() dto: GetPlanningDto) {
    if (user.role === 'AGENT') dto = { ...dto, agentId: user.id };
    return this.svc.getEvents(user.tenantId, dto);
  }

  @Delete('events/:id')
  @Roles('MANAGER', 'ADMIN')
  deleteEvent(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deleteEvent(user.tenantId, id);
  }

  // ── Requests ──────────────────────────────────────────────────

  @Post('requests')
  @Roles(...ALL_ROLES)
  createRequest(@CurrentUser() user: any, @Body() dto: CreateRequestDto) {
    return this.svc.createRequest(user.tenantId, user.sub, dto);
  }

  @Get('requests')
  @Roles(...REVIEWER_ROLES)
  getRequests(@CurrentUser() user: any, @Query() dto: GetPlanningDto) {
    return this.svc.getRequests(user.tenantId, dto);
  }

  @Get('requests/mine')
  @Roles(...ALL_ROLES)
  myRequests(@CurrentUser() user: any) {
    return this.svc.getMyRequests(user.tenantId, user.sub);
  }

  @Post('requests/:id/review')
  @Roles(...REVIEWER_ROLES)
  reviewRequest(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.svc.reviewRequest(user.tenantId, id, user.sub, dto);
  }
}
