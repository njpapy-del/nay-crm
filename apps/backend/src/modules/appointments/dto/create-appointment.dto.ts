import { Type } from 'class-transformer';
import {
  IsArray, IsDateString, IsEnum, IsOptional,
  IsString, MinLength, ValidateNested,
} from 'class-validator';
import { AppointmentStatus } from '@prisma/client';

export class AppointmentResponseValueDto {
  @IsString() fieldId!: string;
  @IsString() value!: string;
}

export class CreateAppointmentDto {
  @IsString() @MinLength(2) title!: string;
  @IsString() @IsOptional() description?: string;
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
  @IsString() agentId!: string;
  @IsString() @IsOptional() leadId?: string;
  @IsString() @IsOptional() campaignId?: string;
  @IsString() @IsOptional() clientId?: string;

  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => AppointmentResponseValueDto)
  responses?: AppointmentResponseValueDto[];
}

export class UpdateAppointmentStatusDto {
  @IsEnum(AppointmentStatus) status!: AppointmentStatus;
}
