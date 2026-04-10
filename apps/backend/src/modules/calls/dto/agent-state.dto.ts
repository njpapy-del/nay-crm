import { IsString, IsOptional, IsEnum } from 'class-validator';

export class AgentLoginDto {
  @IsString()
  extension: string;

  @IsString()
  @IsOptional()
  campaignId?: string;
}

export class AgentCampaignDto {
  @IsString()
  @IsOptional()
  campaignId?: string | null;
}

export class AgentPauseDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

export class CallDispositionDto {
  @IsEnum(['INTERESTED', 'NOT_INTERESTED', 'CALLBACK', 'WRONG_NUMBER', 'VOICEMAIL', 'DNC', 'SALE'])
  disposition: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  callbackAt?: string;
}
