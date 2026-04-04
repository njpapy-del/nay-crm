import { Module } from '@nestjs/common';
import { SupervisionController } from './supervision.controller';
import { SupervisionService } from './supervision.service';
import { SupervisionGateway } from './supervision.gateway';
import { CallsModule } from '../calls/calls.module';

@Module({
  imports: [CallsModule],
  controllers: [SupervisionController],
  providers: [SupervisionService, SupervisionGateway],
  exports: [SupervisionService, SupervisionGateway],
})
export class SupervisionModule {}
