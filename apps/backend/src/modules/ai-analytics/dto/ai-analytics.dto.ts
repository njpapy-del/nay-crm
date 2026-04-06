import {
  IsString, IsOptional, IsInt, Min, Max, IsEnum,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class SummarizeCallDto {
  @IsString()
  transcription: string;

  @IsOptional()
  @IsString()
  callId?: string;
}

export class ScoreCallDto {
  @IsString()
  transcription: string;

  @IsOptional()
  @IsString()
  callId?: string;
}

export class SuggestScriptDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  campaignId?: string;
}

export class AnalyzeAgentDto {
  @IsString()
  agentId: string;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 30))
  @IsInt()
  @Min(7)
  @Max(90)
  periodDays?: number = 30;
}

export enum AiJobTypeFilter {
  SUMMARY     = 'SUMMARY',
  SCORING     = 'SCORING',
  SUGGESTIONS = 'SUGGESTIONS',
  PERFORMANCE = 'PERFORMANCE',
}

export class GetAiHistoryDto {
  @IsOptional()
  @IsEnum(AiJobTypeFilter)
  type?: AiJobTypeFilter;

  @IsOptional()
  @Transform(({ value }) => (value ? parseInt(String(value), 10) : 20))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
