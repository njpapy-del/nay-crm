import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CallQualification, SaleStatus } from '@prisma/client';

export class FilterSaleDto {
  @IsOptional() @IsString()         agentId?: string;
  @IsOptional() @IsString()         campaignId?: string;
  @IsOptional() @IsString()         clientId?: string;
  @IsOptional() @IsEnum(SaleStatus) status?: SaleStatus;

  @IsOptional() @IsEnum(CallQualification)
  qualification?: CallQualification;

  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) minAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) maxAmount?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) skip?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}
