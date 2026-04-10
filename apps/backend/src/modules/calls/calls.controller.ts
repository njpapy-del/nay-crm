import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { AgentStateService } from './agent-state.service';
import { DialerService } from './dialer.service';
import { MonitoringService } from './monitoring.service';
import { OriginateCallDto, UpdateCallDto } from './dto/originate-call.dto';
import { AgentLoginDto, AgentPauseDto, AgentCampaignDto, CallDispositionDto } from './dto/agent-state.dto';
import { StartDialerDto } from './dto/dialer.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CallDisposition } from '@prisma/client';

@Controller('calls')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly agentStateSvc: AgentStateService,
    private readonly dialer: DialerService,
    private readonly monitoring: MonitoringService,
  ) {}

  // ── Historique ────────────────────────────────────────────

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findAll(
    @CurrentUser() user: any,
    @Query('agentId') agentId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    return this.calls.findAll(user.tenantId, {
      agentId, status, limit: limit ? +limit : 50, skip: skip ? +skip : 0,
    });
  }

  @Get('stats')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  stats(@CurrentUser() user: any) {
    return this.calls.stats(user.tenantId);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.calls.findOne(user.tenantId, id);
  }

  @Post('originate')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  originate(@CurrentUser() user: any, @Body() dto: OriginateCallDto) {
    return this.calls.originateCall(user.tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCallDto) {
    return this.calls.update(user.tenantId, id, dto);
  }

  @Post(':id/hangup')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  hangup(@CurrentUser() user: any, @Param('id') id: string) {
    return this.calls.hangup(user.tenantId, id);
  }

  @Patch(':id/disposition')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  async setDisposition(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: CallDispositionDto) {
    return this.calls.update(user.tenantId, id, {
      disposition: dto.disposition as CallDisposition,
      notes: dto.notes,
    });
  }

  // ── Agent State ───────────────────────────────────────────

  @Post('agent/login')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  agentLogin(@CurrentUser() user: any, @Body() dto: AgentLoginDto) {
    return this.agentStateSvc.login(user.tenantId, user.id, dto.extension, dto.campaignId);
  }

  @Patch('agent/campaign')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  agentCampaign(@CurrentUser() user: any, @Body() dto: AgentCampaignDto) {
    return this.agentStateSvc.setCampaign(user.id, dto.campaignId ?? null);
  }

  @Post('agent/logout')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  agentLogout(@CurrentUser() user: any) {
    return this.agentStateSvc.logout(user.id);
  }

  @Post('agent/pause')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  agentPause(@CurrentUser() user: any, @Body() dto: AgentPauseDto) {
    return this.agentStateSvc.setPaused(user.id, dto.reason);
  }

  @Post('agent/resume')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  agentResume(@CurrentUser() user: any) {
    return this.agentStateSvc.setAvailable(user.id);
  }

  @Get('agent/state')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  getAgentState(@CurrentUser() user: any) {
    return this.agentStateSvc.getByAgent(user.id);
  }

  @Get('agent/pending-qualification')
  @Roles('AGENT', 'MANAGER', 'ADMIN')
  async getPendingQualification(@CurrentUser() user: any) {
    const callLogId = await this.agentStateSvc.getPendingQualification(user.id);
    return { pendingQualification: callLogId !== null, callLogId };
  }

  // ── Dialer ────────────────────────────────────────────────

  @Post('dialer/start')
  @Roles('ADMIN', 'MANAGER')
  startDialer(@CurrentUser() user: any, @Body() dto: StartDialerDto) {
    this.dialer.startCampaign(dto.campaignId, user.tenantId, dto.mode, dto.ratio);
    return { ok: true };
  }

  @Post('dialer/stop/:campaignId')
  @Roles('ADMIN', 'MANAGER')
  stopDialer(@Param('campaignId') campaignId: string) {
    this.dialer.stopCampaign(campaignId);
    return { ok: true };
  }

  @Get('dialer/sessions')
  @Roles('ADMIN', 'MANAGER')
  async dialerSessions() {
    return { data: await this.dialer.getActiveSessions() };
  }

  // ── Monitoring ────────────────────────────────────────────

  @Get('monitoring/snapshot')
  @Roles('ADMIN', 'MANAGER')
  snapshot(@CurrentUser() user: any) {
    return this.monitoring.getSnapshot(user.tenantId);
  }

  @Get('monitoring/agents')
  @Roles('ADMIN', 'MANAGER')
  agents(@CurrentUser() user: any) {
    return this.agentStateSvc.getAll(user.tenantId);
  }

  // ── Webhook Asterisk ──────────────────────────────────────

  @Post('asterisk-event')
  @Public()
  handleAsteriskEvent(@Body() body: any) {
    if (body.event === 'hangup') return this.calls.handleHangupWebhook(body);
    return { ok: true };
  }
}
