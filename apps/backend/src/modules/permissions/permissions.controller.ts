import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private svc: PermissionsService) {}

  @Get('modules')  modules() { return this.svc.getModules(); }
  @Get('actions')  actions() { return this.svc.getActions(); }
  @Get('roles')    roles()   { return this.svc.getRoles(); }
  @Get('nav-items') navItems() { return this.svc.getNavItems(); }

  @Get('me')
  myMatrix(@CurrentUser() user: any) {
    return this.svc.getMatrix(user.role);
  }

  /** Permissions menu pour MON rôle — utilisé par la sidebar */
  @Get('menu/me')
  myMenuPerms(@CurrentUser() user: any) {
    return this.svc.getMenuPerms(user.tenantId, user.role);
  }

  /** Grille complète tous rôles — admin seulement */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Get('menu/grid')
  fullGrid(@CurrentUser() user: any) {
    return this.svc.getFullGrid(user.tenantId);
  }

  /** Sauvegarder toutes les perms d'un rôle */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put('menu/:role')
  saveRole(
    @CurrentUser() user: any,
    @Param('role') role: string,
    @Body() body: { perms: Record<string, boolean> },
  ) {
    return this.svc.saveRolePerms(user.tenantId, role, body.perms);
  }

  /** Toggle un seul item */
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @Put('menu/:role/:navKey')
  toggleOne(
    @CurrentUser() user: any,
    @Param('role') role: string,
    @Param('navKey') navKey: string,
    @Body() body: { visible: boolean },
  ) {
    return this.svc.setMenuPerm(user.tenantId, role, navKey, body.visible);
  }

  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'MANAGER')
  @Get('role/:role')
  roleMatrix(@Param('role') role: string) {
    return this.svc.getMatrix(role);
  }
}
