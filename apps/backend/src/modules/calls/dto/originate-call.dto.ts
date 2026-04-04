import { IsString, IsOptional, IsEnum, MinLength } from 'class-validator';
import { CallDisposition } from '@prisma/client';

export class OriginateCallDto {
  @IsString()
  @MinLength(3)
  destination!: string;

  @IsString()
  agentExtension!: string;

  @IsString()
  @IsOptional()
  clientId?: string;

  @IsString()
  @IsOptional()
  leadId?: string;
}

export class UpdateCallDto {
  @IsEnum(['ANSWERED', 'BUSY', 'NO_ANSWER', 'FAILED', 'CANCELLED'])
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsOptional()
  duration?: number;

  @IsEnum(['INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'WRONG_NUMBER', 'VOICEMAIL', 'DNC', 'SALE'])
  @IsOptional()
  disposition?: CallDisposition;
}
