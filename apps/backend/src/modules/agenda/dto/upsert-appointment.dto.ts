import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class UpsertAppointmentDto {
  @IsString()
  agentId: string;

  @IsString()
  title: string;

  @IsISO8601()
  startAt: string;

  @IsISO8601()
  endAt: string;

  @IsOptional() @IsString()      description?: string;
  @IsOptional() @IsString()      leadId?: string;
  @IsOptional() @IsString()      clientId?: string;
  @IsOptional() @IsString()      campaignId?: string;

  @IsOptional() @IsEnum(AppointmentStatus)
  status?: AppointmentStatus;
}
