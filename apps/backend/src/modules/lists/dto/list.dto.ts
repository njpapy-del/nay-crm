import { IsString, IsOptional, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ContactListStatus } from '@prisma/client';

export class CreateListDto {
  @IsString() name: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() campaignId?: string;
}

export class UpdateListDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(ContactListStatus) status?: ContactListStatus;
}

export class FilterListsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsEnum(ContactListStatus) status?: ContactListStatus;
  @IsOptional() @IsString() campaignId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}
