import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSION_KEY, PermissionDef } from '../decorators/require-permission.decorator';

// Default module access by role
const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  ADMIN: { '*': ['read', 'write', 'delete', 'export', 'admin'] },
  MANAGER: {
    clients: ['read', 'write', 'delete', 'export'],
    campaigns: ['read', 'write', 'delete', 'export'],
    calls: ['read', 'write', 'export'],
    analytics: ['read', 'export'],
    kpi: ['read', 'export'],
    reports: ['read', 'write', 'delete', 'export'],
    users: ['read'],
    recordings: ['read', 'export'],
    'call-logs': ['read', 'write', 'export'],
    sales: ['read', 'write', 'export'],
    agenda: ['read', 'write'],
    leads: ['read', 'write'],
    supervision: ['read'],
  },
  AGENT: {
    clients: ['read', 'write'],
    calls: ['read', 'write'],
    'call-logs': ['read', 'write'],
    campaigns: ['read'],
    leads: ['read', 'write'],
    agenda: ['read', 'write'],
    sales: ['read', 'write'],
  },
  QUALITY: {
    recordings: ['read', 'export'],
    'call-logs': ['read', 'write', 'export'],
    kpi: ['read', 'export'],
    reports: ['read', 'export'],
    analytics: ['read', 'export'],
    calls: ['read'],
  },
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const perm = this.reflector.getAllAndOverride<PermissionDef>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!perm) return true;

    const req = ctx.switchToHttp().getRequest();
    const user = req.user;
    if (!user) return false;

    const role: string = user.role;
    const roleDefs = ROLE_PERMISSIONS[role];
    if (!roleDefs) throw new ForbiddenException('Rôle inconnu');

    // ADMIN wildcard
    if (roleDefs['*']?.includes(perm.action)) return true;
    if (roleDefs['*']?.includes('admin')) return true;

    const allowed = roleDefs[perm.module] ?? [];
    if (!allowed.includes(perm.action)) {
      throw new ForbiddenException(`Action '${perm.action}' non autorisée sur '${perm.module}'`);
    }
    return true;
  }
}
