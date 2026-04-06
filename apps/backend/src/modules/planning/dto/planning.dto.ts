import { IsEnum, IsString, IsOptional, IsDateString } from 'class-validator';
import { PlanningEventType, PlanningStatus } from '@prisma/client';

export class CreatePlanningDto {
  @IsString()
  agentId!: string;

  @IsEnum(PlanningEventType)
  type!: PlanningEventType;

  @IsString()
  title!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateRequestDto {
  @IsEnum(PlanningEventType)
  type!: PlanningEventType;

  @IsString()
  title!: string;

  @IsDateString()
  startAt!: string;

  @IsDateString()
  endAt!: string;

  @IsOptional()
  @IsString()
  motif?: string;
}

export class ReviewRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  notes?: string;
}

export class GetPlanningDto {
  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsEnum(PlanningEventType)
  type?: PlanningEventType;

  @IsOptional()
  @IsString()
  status?: string;
}
