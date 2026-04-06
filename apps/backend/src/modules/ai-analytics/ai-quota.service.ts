import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanCode } from '@prisma/client';

// ── Quotas mensuels par plan ──────────────────────────────────────────────────
const AI_QUOTA: Record<PlanCode, number> = {
  BASIC:      0,
  PRO:        100,
  ENTERPRISE: 1_000,
};

const PREMIUM_PLANS: PlanCode[] = ['PRO', 'ENTERPRISE'];

const currentMonth = () => new Date().toISOString().slice(0, 7); // "2026-04"

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Vérifie et consomme 1 unité de quota ─────────────────────────────────

  async checkAndConsume(tenantId: string): Promise<void> {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    // Vérification abonnement
    if (!sub || !['ACTIVE', 'TRIAL'].includes(sub.status)) {
      throw new ForbiddenException(
        'Abonnement inactif. Veuillez renouveler votre abonnement pour accéder à l\'IA analytique.',
      );
    }

    const planCode = sub.plan.code as PlanCode;

    // Vérification plan premium
    if (!PREMIUM_PLANS.includes(planCode)) {
      throw new ForbiddenException(
        'Fonctionnalité disponible uniquement en plan PRO ou ENTREPRISE. ' +
        'Passez à un plan supérieur pour accéder à l\'IA analytique.',
      );
    }

    const month = currentMonth();
    const quota = AI_QUOTA[planCode];

    // Upsert usage du mois en cours
    const usage = await this.prisma.aiUsage.upsert({
      where:  { tenantId_month: { tenantId, month } },
      create: { tenantId, month, jobCount: 0 },
      update: {},
    });

    if (usage.jobCount >= quota) {
      throw new ForbiddenException(
        `Quota IA épuisé pour ce mois (${usage.jobCount}/${quota}). ` +
        'Le quota se renouvelle automatiquement le 1er du mois prochain.',
      );
    }

    // Incrémenter
    await this.prisma.aiUsage.update({
      where: { tenantId_month: { tenantId, month } },
      data:  { jobCount: { increment: 1 } },
    });
  }

  // ── Expose l'état du quota (pour le frontend) ─────────────────────────────

  async getUsage(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });

    const planCode  = (sub?.plan?.code as PlanCode) ?? 'BASIC';
    const isPremium = PREMIUM_PLANS.includes(planCode);
    const quota     = AI_QUOTA[planCode];
    const month     = currentMonth();

    const usage = await this.prisma.aiUsage.findUnique({
      where: { tenantId_month: { tenantId, month } },
    });

    const used      = usage?.jobCount ?? 0;
    const remaining = Math.max(0, quota - used);

    return { plan: planCode, isPremium, quota, used, remaining, month };
  }
}
