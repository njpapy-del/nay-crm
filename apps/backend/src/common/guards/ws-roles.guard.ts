import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

export const WS_ROLES_KEY = 'ws_roles';

/**
 * Guard WebSocket réutilisable — vérifie le rôle stocké dans socket.data
 *
 * Usage :
 *   @UseGuards(WsRolesGuard)
 *   @SetMetadata(WS_ROLES_KEY, ['ADMIN', 'MANAGER'])
 *
 * Prérequis : le handler `join` doit stocker le rôle dans client.data.role
 */
@Injectable()
export class WsRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(WS_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) return true;

    const client: Socket = context.switchToWs().getClient();
    // JWT auth sets client.data.user.role; legacy sup:join sets client.data.role
    const role: string | undefined = (client.data as any)?.user?.role ?? (client.data as any)?.role;

    if (!role || !requiredRoles.includes(role)) {
      client.emit('sup:error', { message: 'Accès refusé — permissions insuffisantes' });
      throw new WsException('Permissions insuffisantes');
    }

    return true;
  }
}
