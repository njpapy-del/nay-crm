import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';
import { AmiService } from './asterisk/ami.service';
import { AgentStateService } from './agent-state.service';
import { DialerService } from './dialer.service';
import { MonitoringService } from './monitoring.service';

@Module({
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsGateway,
    AmiService,
    AgentStateService,
    DialerService,
    MonitoringService,
  ],
  exports: [CallsService, AmiService, AgentStateService, DialerService, MonitoringService],
})
export class CallsModule {}
