import { IsString, IsOptional, IsBoolean, IsEnum, IsInt, IsArray, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ScriptFieldType } from '@prisma/client';

export class CreateScriptDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() campaignId?: string;
}

export class UpdateScriptDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class FieldConditionDto {
  @IsString() ifFieldId!: string;
  @IsString() ifValue!: string;
  @IsString() action!: 'show' | 'hide';
}

export class CreateFieldDto {
  @IsString() label!: string;
  @IsEnum(ScriptFieldType) type!: ScriptFieldType;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => FieldConditionDto) conditions?: FieldConditionDto[];
  @IsOptional() @IsString() placeholder?: string;
}

export class UpdateFieldDto {
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsEnum(ScriptFieldType) type?: ScriptFieldType;
  @IsOptional() @IsBoolean() required?: boolean;
  @IsOptional() @IsInt() @Min(0) order?: number;
  @IsOptional() @IsArray() options?: string[];
  @IsOptional() @IsArray() conditions?: FieldConditionDto[];
  @IsOptional() @IsString() placeholder?: string;
}

export class ReorderFieldsDto {
  @IsArray() ids!: string[];
}

export class SaveResponseDto {
  @IsOptional() @IsString() callId?: string;
  @IsOptional() @IsString() contactId?: string;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @IsBoolean() isComplete?: boolean;
  values!: Record<string, unknown>; // fieldId → value
}
