import { Controller, Post, Get, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { QualificationsService } from './qualifications.service';
import { QualifyCallDto } from './qualifications.dto';

@UseGuards(JwtAuthGuard)
@Controller('qualifications')
export class QualificationsController {
  constructor(private readonly svc: QualificationsService) {}

  @Post()
  qualify(@Req() req: any, @Body() dto: QualifyCallDto) {
    return this.svc.qualify(req.tenantId, req.user?.sub ?? req.user?.id, dto);
  }

  @Get('context/:callId')
  getContext(@Req() req: any, @Param('callId') callId: string) {
    return this.svc.getCallContext(req.tenantId, callId);
  }

  @Get('stats')
  getStats(@Req() req: any, @Query('campaignId') campaignId?: string) {
    return this.svc.getStats(req.tenantId, campaignId);
  }
}
