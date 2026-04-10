import { IsString, IsOptional, IsBoolean, IsNumber, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GridItemDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  name: string;

  @IsNumber()
  @Min(0.1) @Max(10)
  weight: number = 1.0;

  @IsNumber()
  @Min(1) @Max(10)
  maxScore: number = 5;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @IsNumber()
  @IsOptional()
  position?: number = 0;
}

export class CreateQualityGridDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  campaignId?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean = false;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  @IsOptional()
  items?: GridItemDto[] = [];
}

export class UpdateQualityGridDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GridItemDto)
  @IsOptional()
  items?: GridItemDto[];
}
