import { IsString, IsOptional, IsEnum, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { RecordingFormat } from '@prisma/client';

export class FilterRecordingsDto {
  @IsOptional() @IsString()  agentId?: string;
  @IsOptional() @IsString()  campaignId?: string;
  @IsOptional() @IsString()  phone?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minDuration?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) maxDuration?: number;
  @IsOptional() @IsEnum(RecordingFormat) format?: RecordingFormat;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 30;
}

export class SyncRecordingDto {
  @IsString() callId: string;
  @IsString() filePath: string;
  @IsString() fileName: string;
  @IsOptional() @IsEnum(RecordingFormat) format?: RecordingFormat;
  @IsOptional() @Type(() => Number) @IsInt() durationSec?: number;
  @IsOptional() @Type(() => Number) @IsInt() fileSize?: number;
  @IsOptional() @IsString() asteriskId?: string;
}
