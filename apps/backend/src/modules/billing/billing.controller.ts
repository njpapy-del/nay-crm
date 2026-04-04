import {
  Body, Controller, Post, RawBodyRequest, Req, UseGuards,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';
import { IsString } from 'class-validator';

class CheckoutDto {
  @IsString() planCode: string;
  @IsString() returnUrl: string;
}

@Controller('billing')
export class BillingController {
  constructor(private svc: BillingService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('checkout')
  checkout(@CurrentUser() user: any, @Body() dto: CheckoutDto) {
    return this.svc.createCheckoutSession(user.tenantId, dto.planCode, dto.returnUrl);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('portal')
  portal(@CurrentUser() user: any, @Body() dto: { returnUrl: string }) {
    return this.svc.createPortalSession(user.tenantId, dto.returnUrl);
  }

  @Post('webhook')
  webhook(@Req() req: RawBodyRequest<Request>) {
    const sig = req.headers['stripe-signature'] as string;
    return this.svc.handleWebhook(req.rawBody!, sig);
  }
}
