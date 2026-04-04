import { IsString, IsOptional, IsEnum, IsArray, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { BlacklistScope } from '@prisma/client';

export class CreateBlacklistDto {
  @IsString() name: string;
  @IsOptional() @IsEnum(BlacklistScope) scope?: BlacklistScope = BlacklistScope.TENANT;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() campaignId?: string;
}

export class AddEntryDto {
  @IsString() phone: string;
  @IsOptional() @IsString() reason?: string;
}

export class BulkAddEntriesDto {
  @IsArray() @IsString({ each: true }) phones: string[];
  @IsOptional() @IsString() reason?: string;
}

export class FilterBlacklistDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(BlacklistScope) scope?: BlacklistScope;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 50;
}
