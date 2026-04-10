import { IsString, IsOptional, IsArray, IsNumber, IsEnum, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class EvalItemDto {
  @IsString()
  gridItemId: string;

  @IsNumber()
  @Min(0)
  score: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CreateEvaluationDto {
  @IsString()
  callLogId: string;

  @IsString()
  agentId: string;

  @IsString()
  gridId: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EvalItemDto)
  items: EvalItemDto[];
}

export class QualifyAppointmentDto {
  @IsEnum(['OK', 'KO', 'HCC', 'HC'])
  status: 'OK' | 'KO' | 'HCC' | 'HC';

  @IsNumber()
  @Min(0) @Max(100)
  @IsOptional()
  qualityScore?: number;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class CreateQualityActionDto {
  @IsString()
  agentId: string;

  @IsEnum(['FORMATION', 'DEBRIEF', 'RECADRAGE'])
  type: 'FORMATION' | 'DEBRIEF' | 'RECADRAGE';

  @IsString()
  comment: string;

  @IsString()
  @IsOptional()
  evaluationId?: string;
}

export class KpiQueryDto {
  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  campaignId?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
