import { Module } from '@nestjs/common';
import { AiAnalyticsController } from './ai-analytics.controller';
import { AiAnalyticsService } from './ai-analytics.service';
import { AiQuotaService } from './ai-quota.service';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule, QueueModule],
  controllers: [AiAnalyticsController],
  providers: [AiAnalyticsService, AiQuotaService],
  exports: [AiAnalyticsService, AiQuotaService],
})
export class AiAnalyticsModule {}
