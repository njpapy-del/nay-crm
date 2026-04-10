import { ApiProperty } from '@nestjs/swagger';
import { ClientQualification } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class QualifyClientDto {
  @ApiProperty({ enum: ClientQualification })
  @IsEnum(ClientQualification)
  qualification: ClientQualification;
}
