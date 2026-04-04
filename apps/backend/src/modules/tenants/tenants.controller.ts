import {
  Body, Controller, Get, Param, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { IsOptional, IsString, MinLength } from 'class-validator';

class CreateTenantDto {
  @IsString() @MinLength(2) name: string;
  @IsString() @MinLength(2) slug: string;
  @IsOptional() @IsString() subdomain?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
}

class UpdateTenantDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() logoUrl?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private svc: TenantsService) {}

  /** Super-admin: liste tous les tenants */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll(@Query() dto: PaginationDto) {
    return this.svc.findAll(dto);
  }

  /** Super-admin: stats globales */
  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  stats() {
    return this.svc.getStats();
  }

  /** Mon tenant (admin entreprise) */
  @Get('me')
  me(@CurrentUser() user: any) {
    return this.svc.findMine(user.tenantId);
  }

  /** Quota check */
  @Get('me/quota/:resource')
  quota(@CurrentUser() user: any, @Param('resource') resource: 'agents' | 'calls') {
    return this.svc.checkQuota(user.tenantId, resource);
  }

  /** Super-admin: get one */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  /** Onboarding public — pas de JWT */
  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.svc.create(dto);
  }

  /** Admin entreprise: MAJ son tenant */
  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: UpdateTenantDto) {
    return this.svc.update(user.tenantId, dto);
  }

  /** Super-admin: toggle active */
  @Patch(':id/toggle-active')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  toggleActive(@Param('id') id: string) {
    return this.svc.toggleActive(id);
  }
}
