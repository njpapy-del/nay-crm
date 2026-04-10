import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsOptional,
  IsString, Max, Min, ValidateNested,
} from 'class-validator';

export enum CriteriaFieldType {
  TEXT         = 'TEXT',
  NUMBER       = 'NUMBER',
  BOOLEAN      = 'BOOLEAN',
  SELECT       = 'SELECT',
  MULTI_SELECT = 'MULTI_SELECT',
}

export class FieldOptionDto {
  @IsString() label: string;
  @IsString() value: string;
  @IsBoolean() @IsOptional() isPositive?: boolean;
}

export class FieldValidationDto {
  @IsOptional() min?: number;
  @IsOptional() max?: number;
  @IsString() @IsOptional() expected?: string;
}

export class CriteriaFieldDto {
  @IsString() label: string;
  @IsString() key: string;
  @IsEnum(CriteriaFieldType) type: CriteriaFieldType;
  @IsBoolean()  @IsOptional() required?: boolean;
  @IsInt() @Min(1) @Max(10) @IsOptional() weight?: number;
  @IsInt() @IsOptional() position?: number;
  @IsArray() @IsOptional() @ValidateNested({ each: true }) @Type(() => FieldOptionDto)
  options?: FieldOptionDto[];
  @IsOptional() @ValidateNested() @Type(() => FieldValidationDto)
  validation?: FieldValidationDto;
}

export class UpsertCriteriaDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsInt() @Min(0) @Max(100) @IsOptional() minScoreOk?: number;
  @IsArray() @ValidateNested({ each: true }) @Type(() => CriteriaFieldDto)
  fields: CriteriaFieldDto[];
}

export class ReviewScoreDto {
  @IsEnum(['OK', 'KO']) status: 'OK' | 'KO';
  @IsString() @IsOptional() reviewNotes?: string;
}
