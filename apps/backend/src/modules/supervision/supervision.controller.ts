import { Controller, Post, Delete, Get, Body, Param, UseGuards } from '@nestjs/common';
import { SupervisionService } from './supervision.service';
import { SpyActionDto, StopSpyDto } from './dto/spy.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('supervision')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
export class SupervisionController {
  constructor(private readonly service: SupervisionService) {}

  @Post('spy')
  startSpy(@CurrentUser() user: any, @Body() dto: SpyActionDto) {
    return this.service.startSpy(user.id, dto.supervisorExtension, dto.targetExtension, dto.mode);
  }

  @Post('spy/switch')
  switchMode(@CurrentUser() user: any, @Body() body: { mode: 'listen' | 'whisper' | 'barge' }) {
    return this.service.switchMode(user.id, body.mode);
  }

  @Delete('spy')
  stopSpy(@CurrentUser() user: any) {
    return this.service.stopSpy(user.id);
  }

  @Get('spy/sessions')
  getSessions() {
    return { data: this.service.getActiveSessions() };
  }

  @Get('client-card/:callId')
  getClientCard(@Param('callId') callId: string) {
    return this.service.getClientCard(callId);
  }
}
