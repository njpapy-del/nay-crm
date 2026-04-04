import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveSessions(tenantId: string) {
    return this.prisma.userSession.findMany({
      where: { tenantId, expiresAt: { gt: new Date() } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async forceLogout(tenantId: string, sessionId: string) {
    const session = await this.prisma.userSession.findFirst({ where: { id: sessionId, tenantId } });
    if (!session) return { message: 'Session introuvable' };
    await this.prisma.userSession.delete({ where: { id: sessionId } });
    return { message: 'Session terminée' };
  }

  async forceLogoutUser(tenantId: string, userId: string) {
    const { count } = await this.prisma.userSession.deleteMany({ where: { tenantId, userId } });
    return { message: `${count} session(s) terminée(s)` };
  }

  async getStats(tenantId: string) {
    const now = new Date();
    const [active, total] = await Promise.all([
      this.prisma.userSession.count({ where: { tenantId, expiresAt: { gt: now } } }),
      this.prisma.userSession.count({ where: { tenantId } }),
    ]);
    return { active, total };
  }

  async cleanExpired() {
    const { count } = await this.prisma.userSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return count;
  }

  /** Called from auth on login to track session */
  async upsertSession(data: {
    userId: string; tenantId: string; token: string;
    ip?: string; userAgent?: string; expiresAt: Date;
  }) {
    return this.prisma.userSession.upsert({
      where: { token: data.token },
      create: data,
      update: { lastSeenAt: new Date() },
    });
  }
}
