import {
  BadRequestException, Injectable, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanCode } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  // ── Plans publics ─────────────────────────────────────────────────────
  async getPlans() {
    return this.prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceMonthly: 'asc' } });
  }

  async getPlanByCode(code: PlanCode) {
    const plan = await this.prisma.plan.findUnique({ where: { code } });
    if (!plan) throw new NotFoundException(`Plan ${code} introuvable`);
    return plan;
  }

  // ── Subscription courante ─────────────────────────────────────────────
  async getMySubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true, billingInvoices: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
    if (!sub) return null;

    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86400000);
    return { ...sub, daysLeft };
  }

  // ── Souscrire / changer de plan ───────────────────────────────────────
  async subscribe(tenantId: string, planCode: PlanCode) {
    const plan = await this.getPlanByCode(planCode);
    const existing = await this.prisma.subscription.findUnique({ where: { tenantId } });

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    if (existing) {
      return this.prisma.subscription.update({
        where: { tenantId },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          currentPeriodStart: new Date(),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
        include: { plan: true },
      });
    }

    return this.prisma.subscription.create({
      data: {
        tenantId,
        planId: plan.id,
        status: 'TRIAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd,
      },
      include: { plan: true },
    });
  }

  // ── Annuler en fin de période ─────────────────────────────────────────
  async cancel(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Aucun abonnement');
    return this.prisma.subscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: true },
    });
  }

  // ── Réactiver ─────────────────────────────────────────────────────────
  async reactivate(tenantId: string) {
    return this.prisma.subscription.update({
      where: { tenantId },
      data: { cancelAtPeriodEnd: false, status: 'ACTIVE' },
    });
  }

  // ── Historique factures ───────────────────────────────────────────────
  async getInvoices(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) return [];
    return this.prisma.billingInvoice.findMany({
      where: { subscriptionId: sub.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Admin: gérer les plans ─────────────────────────────────────────────
  async upsertPlan(data: {
    code: PlanCode; name: string; description?: string;
    priceMonthly: number; priceYearly: number;
    maxAgents: number; maxCalls: number; maxStorage: number;
    modules: string[];
  }) {
    return this.prisma.plan.upsert({
      where: { code: data.code },
      create: data,
      update: data,
    });
  }

  // ── Cron: vérifier expirations ─────────────────────────────────────────
  async checkExpirations() {
    const expired = await this.prisma.subscription.findMany({
      where: {
        status: { in: ['TRIAL', 'ACTIVE'] },
        currentPeriodEnd: { lte: new Date() },
      },
    });

    for (const sub of expired) {
      const newStatus = sub.cancelAtPeriodEnd || sub.status === 'TRIAL' ? 'CANCELLED' : 'PAST_DUE';
      await this.prisma.subscription.update({
        where: { id: sub.id },
        data: { status: newStatus },
      });
    }
    return { processed: expired.length };
  }

  // ── Admin: suspendre/réactiver tenant ────────────────────────────────
  async suspend(tenantId: string) {
    return this.prisma.subscription.update({ where: { tenantId }, data: { status: 'SUSPENDED' } });
  }

  async activate(tenantId: string) {
    return this.prisma.subscription.update({ where: { tenantId }, data: { status: 'ACTIVE' } });
  }
}
