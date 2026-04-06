import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';
import { AssignAgentsDto } from './dto/assign-agents.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsOptional, IsString, IsBoolean, IsNumber, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class UpsertSettingsDto {
  @IsOptional() @IsIn(['MANUAL','PROGRESSIVE','PREDICTIVE','PREVIEW']) dialerMode?: string;
  @IsOptional() @IsNumber() @Type(() => Number) dialerSpeed?: number;
  @IsOptional() @IsNumber() @Type(() => Number) maxSimultaneousCalls?: number;
  @IsOptional() @IsNumber() @Type(() => Number) agentRatio?: number;
  @IsOptional() @IsNumber() @Type(() => Number) maxAttempts?: number;
  @IsOptional() @IsNumber() @Type(() => Number) retryDelayMin?: number;
  @IsOptional() @IsNumber() @Type(() => Number) wrapUpTimeSec?: number;
  @IsOptional() @IsBoolean() enableRecording?: boolean;
  @IsOptional() @IsBoolean() enableDnc?: boolean;
  @IsOptional() @IsBoolean() customQualifEnabled?: boolean;
}

class CreateQualifDto {
  @IsOptional() @IsString() campaignId?: string;
  @IsString() label!: string;
  @IsString() code!: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() isPositive?: boolean;
  @IsOptional() @IsNumber() @Type(() => Number) position?: number;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CampaignsController {
  constructor(private readonly service: CampaignsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findAll(
    @CurrentUser() user: any,
    @Query('status')   status?: string,
    @Query('search')   search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo')   dateTo?: string,
  ) {
    return this.service.findAll(user.tenantId, { status, search, dateFrom, dateTo });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    return this.service.create(user.tenantId, user.id, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateCampaignDto) {
    return this.service.update(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'MANAGER')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  @Post(':id/agents')
  @Roles('ADMIN', 'MANAGER')
  assignAgents(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: AssignAgentsDto) {
    return this.service.assignAgents(user.tenantId, id, dto.agentIds);
  }

  @Delete(':id/agents/:agentId')
  @Roles('ADMIN', 'MANAGER')
  removeAgent(@CurrentUser() user: any, @Param('id') id: string, @Param('agentId') agentId: string) {
    return this.service.removeAgent(user.tenantId, id, agentId);
  }

  // ─── Dédoublonnage leads ─────────────────────────────────────────────────

  @Post(':id/deduplicate')
  @Roles('ADMIN', 'MANAGER')
  deduplicate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.deduplicateLeads(user.tenantId, id);
  }

  // ─── Recyclage intelligent ────────────────────────────────────────────────

  @Post(':id/recycle')
  @Roles('ADMIN', 'MANAGER')
  recycle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('mode') mode: 'not_reached' | 'failed_calls' | 'all' = 'all',
  ) {
    return this.service.recycleLeads(user.tenantId, id, mode);
  }

  // ─── Settings ────────────────────────────────────────────────────────────

  @Get(':id/settings')
  @Roles('ADMIN', 'MANAGER')
  getSettings(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getSettings(user.tenantId, id);
  }

  @Patch(':id/settings')
  @Roles('ADMIN', 'MANAGER')
  upsertSettings(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpsertSettingsDto) {
    return this.service.upsertSettings(user.tenantId, id, dto);
  }

  // ─── Qualifications ───────────────────────────────────────────────────────

  @Get('qualifications/list')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  getQualifications(@CurrentUser() user: any, @Query('campaignId') campaignId?: string) {
    return this.service.getQualifications(user.tenantId, campaignId);
  }

  @Get(':id/qualifications')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  getCampaignQualifications(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.getQualifications(user.tenantId, id);
  }

  @Post('qualifications')
  @Roles('ADMIN', 'MANAGER')
  createQualification(@CurrentUser() user: any, @Body() dto: CreateQualifDto) {
    return this.service.createQualification(user.tenantId, dto);
  }

  @Patch('qualifications/:qualifId')
  @Roles('ADMIN', 'MANAGER')
  updateQualification(@CurrentUser() user: any, @Param('qualifId') qualifId: string, @Body() dto: Partial<CreateQualifDto>) {
    return this.service.updateQualification(user.tenantId, qualifId, dto);
  }

  @Delete('qualifications/:qualifId')
  @Roles('ADMIN', 'MANAGER')
  deleteQualification(@CurrentUser() user: any, @Param('qualifId') qualifId: string) {
    return this.service.deleteQualification(user.tenantId, qualifId);
  }

  // ─── Stats ────────────────────────────────────────────────────────────────

  @Get('meta/stats')
  @Roles('ADMIN', 'MANAGER')
  getStats(@CurrentUser() user: any, @Query('campaignId') campaignId?: string) {
    return this.service.getStats(user.tenantId, campaignId);
  }
}
