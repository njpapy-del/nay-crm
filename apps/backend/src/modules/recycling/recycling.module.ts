import { Module } from '@nestjs/common';
import { RecyclingService } from './recycling.service';
import { RecyclingController } from './recycling.controller';

@Module({
  controllers: [RecyclingController],
  providers: [RecyclingService],
  exports: [RecyclingService],
})
export class RecyclingModule {}
