import {
  ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { paginate, paginationParams, PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

  // ── List (super-admin) ──────────────────────────────────────────────────
  async findAll(dto: PaginationDto) {
    const { skip, take, page, limit } = paginationParams(dto);
    const where = dto.search
      ? { OR: [{ name: { contains: dto.search, mode: 'insensitive' as const } }, { slug: { contains: dto.search, mode: 'insensitive' as const } }] }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.tenant.findMany({
        where,
        skip,
        take,
        include: { subscription: { include: { plan: true } }, _count: { select: { users: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.tenant.count({ where }),
    ]);
    return paginate(data, total, page, limit);
  }

  // ── Get one ─────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const t = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { users: true, clients: true, campaigns: true } },
      },
    });
    if (!t) throw new NotFoundException('Tenant introuvable');
    return t;
  }

  // ── Get my tenant ────────────────────────────────────────────────────────
  async findMine(tenantId: string) {
    return this.findOne(tenantId);
  }

  // ── Create (onboarding public) ───────────────────────────────────────────
  async create(data: {
    name: string; slug: string; subdomain?: string;
    address?: string; phone?: string;
  }) {
    const slugExists = await this.prisma.tenant.findUnique({ where: { slug: data.slug } });
    if (slugExists) throw new ConflictException('Ce slug est déjà utilisé');

    if (data.subdomain) {
      const subExists = await this.prisma.tenant.findUnique({ where: { subdomain: data.subdomain } });
      if (subExists) throw new ConflictException('Ce sous-domaine est déjà utilisé');
    }

    // Find BASIC plan for trial
    const basicPlan = await this.prisma.plan.findUnique({ where: { code: 'BASIC' } });

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.name,
        slug: data.slug,
        subdomain: data.subdomain,
        address: data.address,
        phone: data.phone,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    });

    if (basicPlan) {
      await this.prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: basicPlan.id,
          status: 'TRIAL',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }

    return tenant;
  }

  // ── Update my tenant ─────────────────────────────────────────────────────
  async update(id: string, data: { name?: string; address?: string; phone?: string; logoUrl?: string }) {
    await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data });
  }

  // ── Check quota ──────────────────────────────────────────────────────────
  async checkQuota(tenantId: string, resource: 'agents' | 'calls') {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub) return { allowed: true, current: 0, max: 999 };

    if (sub.status === 'SUSPENDED' || sub.status === 'CANCELLED') {
      throw new ForbiddenException('Abonnement suspendu');
    }

    if (resource === 'agents') {
      const current = await this.prisma.user.count({ where: { tenantId, isActive: true } });
      return { allowed: current < sub.plan.maxAgents, current, max: sub.plan.maxAgents };
    }
    return { allowed: true, current: 0, max: sub.plan.maxCalls };
  }

  // ── Toggle active (super-admin) ──────────────────────────────────────────
  async toggleActive(id: string) {
    const t = await this.findOne(id);
    return this.prisma.tenant.update({ where: { id }, data: { isActive: !t.isActive } });
  }

  // ── Stats (super-admin) ──────────────────────────────────────────────────
  async getStats() {
    const [total, active, trial, subscriptions] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { isActive: true } }),
      this.prisma.subscription.count({ where: { status: 'TRIAL' } }),
      this.prisma.subscription.groupBy({
        by: ['status'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
      }),
    ]);
    return { total, active, trial, subscriptions };
  }
}
