import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import {
  QUEUE_AI_SUMMARY,
  QUEUE_AI_SCORING,
  QUEUE_AI_SUGGESTIONS,
  QUEUE_AI_PERFORMANCE,
} from './queue.constants';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get<string>('REDIS_HOST', 'localhost'),
          port:     cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get<string>('REDIS_PASSWORD') || undefined,
          db:       cfg.get<number>('REDIS_QUEUE_DB', 0),
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUE_AI_SUMMARY },
      { name: QUEUE_AI_SCORING },
      { name: QUEUE_AI_SUGGESTIONS },
      { name: QUEUE_AI_PERFORMANCE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
