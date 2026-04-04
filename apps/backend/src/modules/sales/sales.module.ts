import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesExportService } from './sales-export.service';

@Module({
  controllers: [SalesController],
  providers: [SalesService, SalesExportService],
  exports: [SalesService],
})
export class SalesModule {}
