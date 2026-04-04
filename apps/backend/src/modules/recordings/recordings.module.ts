import { Module } from '@nestjs/common';
import { RecordingsService } from './recordings.service';
import { RecordingsController } from './recordings.controller';
import { RecordingsCron } from './recordings.cron';

@Module({
  controllers: [RecordingsController],
  providers: [RecordingsService, RecordingsCron],
  exports: [RecordingsService],
})
export class RecordingsModule {}
