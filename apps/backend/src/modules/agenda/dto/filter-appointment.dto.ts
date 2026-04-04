import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AppointmentStatus } from '@prisma/client';

export class FilterAppointmentDto {
  @IsOptional() @IsString() agentId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsString() clientId?: string;

  @IsOptional() @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;

  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) skip?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) limit?: number;
}
