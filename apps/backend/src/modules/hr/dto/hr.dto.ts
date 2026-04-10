import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';

export class CreateHrRequestDto {
  @IsEnum(['ABSENCE', 'FORMATION', 'CONGE'])
  type: 'ABSENCE' | 'FORMATION' | 'CONGE';

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  comment?: string;
}

export class ReviewHrRequestDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsString()
  @IsOptional()
  reviewComment?: string;
}

export class HrRequestQueryDto {
  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}

export class AttendanceQueryDto {
  @IsString()
  @IsOptional()
  agentId?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}
