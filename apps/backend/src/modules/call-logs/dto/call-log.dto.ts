import {
  IsString, IsOptional, IsEnum, IsInt, Min, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CallQualification, CallLogStatus } from '@prisma/client';

export class UpdateCallLogDto {
  @IsOptional() @IsEnum(CallQualification) qualification?: CallQualification;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() agentNotes?: string;
  @IsOptional() @IsEnum(CallLogStatus) status?: CallLogStatus;
}

export class FilterCallLogsDto {
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(CallQualification) qualification?: CallQualification;
  @IsOptional() @IsEnum(CallLogStatus) status?: CallLogStatus;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) minDuration?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 30;
}

export class CreateCallLogDto {
  @IsString() callId: string;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsEnum(CallQualification) qualification?: CallQualification;
  @IsOptional() @IsString() notes?: string;
}
