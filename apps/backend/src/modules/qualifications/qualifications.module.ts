import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { QualificationsController } from './qualifications.controller';
import { QualificationsService } from './qualifications.service';

@Module({
  imports: [PrismaModule],
  controllers: [QualificationsController],
  providers: [QualificationsService],
  exports: [QualificationsService],
})
export class QualificationsModule {}
