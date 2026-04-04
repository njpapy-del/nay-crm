import { IsString, IsEnum, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class StartDialerDto {
  @IsString()
  campaignId: string;

  @IsEnum(['PROGRESSIVE', 'PREDICTIVE', 'PREVIEW'])
  @IsOptional()
  mode?: 'PROGRESSIVE' | 'PREDICTIVE' | 'PREVIEW';

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(3)
  ratio?: number;
}
