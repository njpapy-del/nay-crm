import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeService } from './realtime.service';
import { CallsModule } from '../calls/calls.module';
import { SupervisionModule } from '../supervision/supervision.module';

@Module({
  imports: [CallsModule, SupervisionModule],
  providers: [RealtimeGateway, RealtimeService],
  exports: [RealtimeService],
})
export class RealtimeModule {}
