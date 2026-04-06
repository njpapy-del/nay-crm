import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function paginate<T>(data: T[], total: number, page: number, limit: number): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return { data, total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}

export function paginationParams(dto: any) {
  const page = Math.max(1, parseInt(String(dto?.page ?? 1), 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(String(dto?.limit ?? 20), 10) || 20));
  return { skip: (page - 1) * limit, take: limit, page, limit };
}

// Alias for backward compatibility with existing services
export function buildPaginationMeta(total: number, page: number, limit: number) {
  const totalPages = Math.ceil(total / limit);
  return { total, page, limit, totalPages, hasNext: page < totalPages, hasPrev: page > 1 };
}
