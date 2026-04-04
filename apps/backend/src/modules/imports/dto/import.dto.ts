import { IsString, IsOptional, IsObject, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ColumnMapDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsString() phone: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() notes?: string;
}

export class PreviewImportDto {
  @IsObject() columnMap: ColumnMapDto;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) maxRows?: number = 5;
}

export class FilterHistoryDto {
  @IsOptional() @IsString() listId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}
