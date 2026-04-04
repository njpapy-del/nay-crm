import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';

export const CHECK_QUOTA = 'checkQuota';
export const CheckQuota = (resource: 'agents' | 'calls' | 'storage') =>
  (target: any, key: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(CHECK_QUOTA, resource, descriptor.value);
    return descriptor;
  };

@Injectable()
export class QuotaGuard implements CanActivate {
  constructor(private prisma: PrismaService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.get<string>(CHECK_QUOTA, ctx.getHandler());
    if (!resource) return true;

    const req = ctx.switchToHttp().getRequest();
    const tenantId: string = req.tenantId ?? req.user?.tenantId;
    if (!tenantId) return true;

    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub || sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
      throw new ForbiddenException('Abonnement inactif ou expiré');
    }

    if (resource === 'agents') {
      const count = await this.prisma.user.count({ where: { tenantId, isActive: true } });
      if (count >= sub.plan.maxAgents) {
        throw new ForbiddenException(
          `Limite d'agents atteinte (${sub.plan.maxAgents} max pour le plan ${sub.plan.name})`,
        );
      }
    }
    return true;
  }
}
