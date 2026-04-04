import {
  IsString, IsOptional, IsEnum, IsEmail, IsInt, Min, IsArray, IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ContactStatus } from '@prisma/client';

export class UpdateContactDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() nextCallAt?: string;
}

export class FilterContactsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ContactStatus) status?: ContactStatus;
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 50;
}

export class BulkStatusDto {
  @IsArray() @IsString({ each: true }) ids: string[];
  @IsEnum(ContactStatus) status: ContactStatus;
  @IsOptional() @IsString() reason?: string;
}

export class CheckBlacklistDto {
  @IsString() phone: string;
  @IsOptional() @IsString() campaignId?: string;
}
