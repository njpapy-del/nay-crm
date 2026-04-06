import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentStatusController } from './agent-status.controller';
import { AgentStatusService } from './agent-status.service';

@Module({
  imports: [PrismaModule],
  controllers: [AgentStatusController],
  providers: [AgentStatusService],
  exports: [AgentStatusService],
})
export class AgentStatusModule {}
