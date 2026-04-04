import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private svc: PermissionsService) {}

  @Get('modules')
  modules() { return this.svc.getModules(); }

  @Get('actions')
  actions() { return this.svc.getActions(); }

  @Get('roles')
  roles() { return this.svc.getRoles(); }

  /** Matrice pour mon rôle */
  @Get('me')
  myMatrix(@CurrentUser() user: any) {
    return this.svc.getMatrix(user.role);
  }

  /** Matrice pour un rôle (admin seulement) */
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('role/:role')
  roleMatrix(@Param('role') role: string) {
    return this.svc.getMatrix(role);
  }

  /** Défauts d'un rôle */
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('defaults/:role')
  defaults(@Param('role') role: string) {
    return this.svc.getDefaults(role);
  }
}
