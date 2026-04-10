import { Module } from '@nestjs/common';
import { QualityGridService } from './quality-grid.service';
import { QualityGridController } from './quality-grid.controller';

@Module({
  controllers: [QualityGridController],
  providers: [QualityGridService],
  exports: [QualityGridService],
})
export class QualityGridModule {}
