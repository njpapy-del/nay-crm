import { IsString, IsOptional, IsEnum, IsDateString, MinLength } from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsEnum(['EMISSION', 'RECEPTION', 'MIXTE'])
  @IsOptional()
  type?: string;

  @IsEnum(['MANUAL', 'ROUND_ROBIN', 'RANDOM'])
  @IsOptional()
  callerIdRotation?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
