import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';
import { AgentStatusType } from '@prisma/client';

export class ChangeStatusDto {
  @IsEnum(AgentStatusType)
  status!: AgentStatusType;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetStatusHistoryDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
