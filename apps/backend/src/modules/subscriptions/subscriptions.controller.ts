import {
  Body, Controller, Get, Param, Patch, Post, UseGuards,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PlanCode } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsNumber, IsArray } from 'class-validator';

class SubscribeDto {
  @IsEnum(PlanCode) plan: PlanCode;
}

class UpsertPlanDto {
  @IsEnum(PlanCode) code: PlanCode;
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
  @IsNumber() priceMonthly: number;
  @IsNumber() priceYearly: number;
  @IsNumber() maxAgents: number;
  @IsNumber() maxCalls: number;
  @IsNumber() maxStorage: number;
  @IsArray() @IsString({ each: true }) modules: string[];
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private svc: SubscriptionsService) {}

  /** Plans publics */
  @Get('plans')
  getPlans() { return this.svc.getPlans(); }

  /** Plan par code */
  @Get('plans/:code')
  getPlan(@Param('code') code: PlanCode) { return this.svc.getPlanByCode(code); }

  /** Mon abonnement */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: any) { return this.svc.getMySubscription(user.tenantId); }

  /** Mes factures */
  @UseGuards(JwtAuthGuard)
  @Get('me/invoices')
  myInvoices(@CurrentUser() user: any) { return this.svc.getInvoices(user.tenantId); }

  /** Souscrire / changer plan */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Post('subscribe')
  subscribe(@CurrentUser() user: any, @Body() dto: SubscribeDto) {
    return this.svc.subscribe(user.tenantId, dto.plan);
  }

  /** Annuler */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('cancel')
  cancel(@CurrentUser() user: any) { return this.svc.cancel(user.tenantId); }

  /** Réactiver */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('reactivate')
  reactivate(@CurrentUser() user: any) { return this.svc.reactivate(user.tenantId); }

  /** Super-admin: upsert plan */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post('plans')
  upsertPlan(@Body() dto: UpsertPlanDto) { return this.svc.upsertPlan(dto); }

  /** Super-admin: suspendre tenant */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':tenantId/suspend')
  suspend(@Param('tenantId') tid: string) { return this.svc.suspend(tid); }

  /** Super-admin: réactiver tenant */
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Patch(':tenantId/activate')
  activate(@Param('tenantId') tid: string) { return this.svc.activate(tid); }
}
