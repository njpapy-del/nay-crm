import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { QualityService } from './quality.service';
import { CreateEvaluationDto, QualifyAppointmentDto, CreateQualityActionDto, KpiQueryDto } from './dto/quality.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

const QA_ROLES = ['ADMIN', 'MANAGER', 'QUALITY', 'QUALITY_SUPERVISOR'] as const;

@Controller('quality')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QualityController {
  constructor(private readonly svc: QualityService) {}

  // ── KPI (avant routes paramétrées) ───────────────────────

  @Get('kpi')
  @Roles(...QA_ROLES)
  getKpi(@CurrentUser() user: any, @Query() q: KpiQueryDto) {
    return this.svc.getKpi(user.tenantId, q);
  }

  // ── Évaluations ───────────────────────────────────────────

  @Post('evaluations')
  @Roles(...QA_ROLES)
  createEvaluation(@CurrentUser() user: any, @Body() dto: CreateEvaluationDto) {
    return this.svc.createEvaluation(user.tenantId, user.id, dto);
  }

  @Get('evaluations')
  @Roles(...QA_ROLES)
  findEvaluations(
    @CurrentUser() user: any,
    @Query('agentId') agentId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findEvaluations(user.tenantId, agentId, from, to, skip ? +skip : 0, limit ? +limit : 20);
  }

  @Get('evaluations/:id')
  @Roles(...QA_ROLES)
  findOneEvaluation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.findOneEvaluation(user.tenantId, id);
  }

  // ── Qualification RDV ─────────────────────────────────────

  @Post('appointments/:id/qualify')
  @Roles(...QA_ROLES)
  qualifyAppointment(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: QualifyAppointmentDto) {
    return this.svc.qualifyAppointment(user.tenantId, id, user.id, dto);
  }

  @Get('qualifications')
  @Roles(...QA_ROLES)
  findQualifications(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findQualifications(user.tenantId, status, agentId, skip ? +skip : 0, limit ? +limit : 20);
  }

  // ── Actions correctives ───────────────────────────────────

  @Post('actions')
  @Roles(...QA_ROLES)
  createAction(@CurrentUser() user: any, @Body() dto: CreateQualityActionDto) {
    return this.svc.createAction(user.tenantId, user.id, dto);
  }

  @Get('actions')
  @Roles(...QA_ROLES)
  findActions(@CurrentUser() user: any, @Query('agentId') agentId?: string) {
    return this.svc.findActions(user.tenantId, agentId);
  }
}
