import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { OllamaClient } from './ollama.client';
import {
  AiWorkerBase,
  AiSummaryProcessor,
  AiScoringProcessor,
  AiSuggestionsProcessor,
  AiPerformanceProcessor,
} from './ai.worker';

@Module({
  imports: [PrismaModule, QueueModule],
  providers: [
    OllamaClient,
    AiWorkerBase,
    AiSummaryProcessor,
    AiScoringProcessor,
    AiSuggestionsProcessor,
    AiPerformanceProcessor,
  ],
})
export class WorkersModule {}
