import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(data: {
    tenantId: string; userId: string; action: string; module: string;
    entityId?: string; entityType?: string; meta?: any; ip?: string;
  }) {
    return this.prisma.activityLog.create({ data });
  }

  async findAll(tenantId: string, opts: {
    userId?: string; module?: string; action?: string;
    dateFrom?: string; dateTo?: string; page?: number; limit?: number;
  }) {
    const { userId, module, action, dateFrom, dateTo, page = 1, limit = 50 } = opts;
    const skip = (page - 1) * limit;
    const where: any = { tenantId };
    if (userId) where.userId = userId;
    if (module) where.module = module;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    const [data, total] = await this.prisma.$transaction([
      this.prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.activityLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async getModules(tenantId: string) {
    const rows = await this.prisma.activityLog.groupBy({
      by: ['module'],
      where: { tenantId },
      _count: true,
    });
    return rows.map((r) => ({ module: r.module, count: r._count }));
  }
}
