import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';
import { AmiService } from './asterisk/ami.service';
import { AgentStateService } from './agent-state.service';
import { DialerService } from './dialer.service';
import { MonitoringService } from './monitoring.service';
import { WsJwtGuard } from '../../common/guards/ws-jwt.guard';
import { AgentSessionCleanupService } from './agent-session-cleanup.service';
import { RedisStateService } from '../../redis/redis-state.service';

@Module({
  controllers: [CallsController],
  providers: [
    CallsService,
    CallsGateway,
    AmiService,
    AgentStateService,
    DialerService,
    MonitoringService,
    WsJwtGuard,
    AgentSessionCleanupService,
    RedisStateService,
  ],
  exports: [CallsService, AmiService, AgentStateService, DialerService, MonitoringService, RedisStateService],
})
export class CallsModule {}
