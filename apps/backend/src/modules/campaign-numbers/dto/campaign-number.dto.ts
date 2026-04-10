import { IsString, IsOptional, IsBoolean, IsNumber, IsEnum } from 'class-validator';

export class AddNumberDto {
  @IsString()
  number: string;

  @IsString()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = false;

  @IsNumber()
  @IsOptional()
  position?: number = 0;
}

export class UpdateNumberDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsNumber()
  @IsOptional()
  position?: number;
}

export class SetRotationDto {
  @IsEnum(['MANUAL', 'ROUND_ROBIN', 'RANDOM'])
  rotationMode: 'MANUAL' | 'ROUND_ROBIN' | 'RANDOM';
}
