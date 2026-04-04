import { Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class RemindersService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────

  async create(data: {
    tenantId: string; userId: string; clientId?: string;
    title: string; description?: string; dueAt: Date;
  }) {
    return this.prisma.reminder.create({ data, include: { client: { select: { firstName: true, lastName: true } } } });
  }

  async findMine(userId: string, tenantId: string, onlyPending = false) {
    const where: any = { userId, tenantId };
    if (onlyPending) { where.isDone = false; where.dueAt = { lte: new Date(Date.now() + 24 * 3600_000) }; }
    return this.prisma.reminder.findMany({
      where,
      include: { client: { select: { id: true, firstName: true, lastName: true, phone: true } } },
      orderBy: { dueAt: 'asc' },
      take: 50,
    });
  }

  async findDueNow(userId: string, tenantId: string) {
    const now = new Date();
    const in15 = new Date(now.getTime() + 15 * 60_000);
    return this.prisma.reminder.findMany({
      where: {
        userId, tenantId, isDone: false,
        dueAt: { gte: now, lte: in15 },
        notifiedAt: null,
      },
      include: { client: { select: { firstName: true, lastName: true, phone: true } } },
    });
  }

  async markDone(id: string, userId: string) {
    const r = await this.prisma.reminder.findFirst({ where: { id, userId } });
    if (!r) throw new NotFoundException('Rappel introuvable');
    return this.prisma.reminder.update({ where: { id }, data: { isDone: true, doneAt: new Date() } });
  }

  async snooze(id: string, userId: string, minutes = 30) {
    const r = await this.prisma.reminder.findFirst({ where: { id, userId } });
    if (!r) throw new NotFoundException('Rappel introuvable');
    const snoozedTo = new Date(Date.now() + minutes * 60_000);
    return this.prisma.reminder.update({
      where: { id },
      data: { snoozedTo, dueAt: snoozedTo, notifiedAt: null },
    });
  }

  async delete(id: string, userId: string) {
    await this.prisma.reminder.findFirst({ where: { id, userId } });
    return this.prisma.reminder.delete({ where: { id } });
  }

  // ── Cron: vérifier les rappels toutes les minutes ─────────────────────
  @Cron('* * * * *')
  async checkDueReminders() {
    const now = new Date();
    const in5 = new Date(now.getTime() + 5 * 60_000);

    const due = await this.prisma.reminder.findMany({
      where: { isDone: false, dueAt: { lte: in5 }, notifiedAt: null },
      include: {
        user: { select: { id: true, tenantId: true } },
        client: { select: { firstName: true, lastName: true, phone: true } },
      },
    });

    for (const r of due) {
      await this.prisma.reminder.update({ where: { id: r.id }, data: { notifiedAt: now } });
      // Émet un événement WebSocket vers l'agent
      this.events.emit('reminder.due', {
        userId: r.userId,
        tenantId: r.user.tenantId,
        reminder: {
          id: r.id,
          title: r.title,
          dueAt: r.dueAt,
          client: r.client,
        },
      });
    }
  }

  // ── Stats qualité : rappels non traités ──────────────────────────────
  async getOverdueStats(tenantId: string) {
    const now = new Date();
    const overdue = await this.prisma.reminder.groupBy({
      by: ['userId'],
      where: { tenantId, isDone: false, dueAt: { lt: now } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    const userIds = overdue.map((o) => o.userId);
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    return overdue.map((o) => ({
      agent: userMap[o.userId],
      overdueCount: o._count.id,
    }));
  }
}
