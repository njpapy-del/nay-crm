import { IsString, IsEnum, IsOptional } from 'class-validator';

export type SpyMode = 'listen' | 'whisper' | 'barge';

export class SpyActionDto {
  @IsString()
  supervisorExtension: string;   // extension du superviseur (ex: "2000")

  @IsString()
  targetExtension: string;       // extension de l'agent à écouter (ex: "1000")

  @IsEnum(['listen', 'whisper', 'barge'])
  mode: SpyMode;
}

export class SendMessageDto {
  @IsString()
  fromId: string;

  @IsString()
  @IsOptional()
  toAgentId?: string;            // null = broadcast à tous les agents du tenant

  @IsString()
  content: string;
}

export class StopSpyDto {
  @IsString()
  channel: string;               // channel AMI du superviseur espion
}
