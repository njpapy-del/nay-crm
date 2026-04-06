import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService, LlmMessage } from './llm.service';
import { RemindersService } from './reminders.service';

interface AgentContext {
  userId:    string;
  tenantId:  string;
  firstName: string;
  role:      string;
}

@Injectable()
export class ChatbotService {
  constructor(
    private prisma:    PrismaService,
    private llm:       LlmService,
    private reminders: RemindersService,
  ) {}

  // ── Message HTTP (réponse complète) ───────────────────────────────────────
  // Optimisations :
  // 1. _snapshot + _getHistory tournent en parallèle (-~100ms)
  // 2. _save fire-and-forget — pas d'attente après le LLM (-~100ms)

  async sendMessage(ctx: AgentContext, userMessage: string): Promise<{ reply: string }> {
    // 1. Intent rapide (sans LLM)
    const intent = this._parseIntent(userMessage);
    if (intent === 'list_reminders') {
      const list = await this.reminders.findMine(ctx.userId, ctx.tenantId, true);
      if (!list.length) return { reply: '✅ Aucun rappel en attente.' };
      const txt = list.map((r) => {
        const time = new Date(r.dueAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        const c    = r.client ? ` — ${r.client.firstName} ${r.client.lastName}` : '';
        return `• ${time} : ${r.title}${c}`;
      }).join('\n');
      return { reply: `📋 Rappels :\n${txt}` };
    }

    // 2. Snapshot CRM + historique en PARALLÈLE
    const [snap, history] = await Promise.all([
      this._snapshot(ctx),
      this._getHistory(ctx.userId, ctx.tenantId, 4),
    ]);

    // 3. Build messages
    const messages = this._buildMessages(ctx, snap, history, userMessage);

    // 4. Appel LLM
    const reply = await this.llm.chat(messages);

    // 5. Persistance fire-and-forget (ne bloque pas la réponse)
    this._persistMessages(ctx, userMessage, reply);

    return { reply };
  }

  // ── Message WebSocket avec streaming de tokens ────────────────────────────
  // onToken : appelé à chaque fragment reçu → émis immédiatement au client

  async sendMessageStream(
    ctx:         AgentContext,
    userMessage: string,
    onToken:     (token: string) => void,
  ): Promise<void> {
    // Intent rapide
    const intent = this._parseIntent(userMessage);
    if (intent === 'list_reminders') {
      const list = await this.reminders.findMine(ctx.userId, ctx.tenantId, true);
      const reply = list.length
        ? `📋 Rappels :\n${list.map((r) => {
            const time = new Date(r.dueAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const c    = r.client ? ` — ${r.client.firstName} ${r.client.lastName}` : '';
            return `• ${time} : ${r.title}${c}`;
          }).join('\n')}`
        : '✅ Aucun rappel en attente.';
      onToken(reply);
      this._persistMessages(ctx, userMessage, reply);
      return;
    }

    // Snapshot + historique en parallèle
    const [snap, history] = await Promise.all([
      this._snapshot(ctx),
      this._getHistory(ctx.userId, ctx.tenantId, 4),
    ]);

    const messages = this._buildMessages(ctx, snap, history, userMessage);

    // LLM streaming — onToken appelé pour chaque fragment
    const fullReply = await this.llm.streamChat(messages, onToken);

    // Sauvegarde fire-and-forget
    this._persistMessages(ctx, userMessage, fullReply);
  }

  // ── Alertes qualité ───────────────────────────────────────────────────────

  async getQualityAlerts(tenantId: string): Promise<string[]> {
    const alerts: string[] = [];
    const now = new Date();

    const [overdueStats, unqualified] = await Promise.all([
      this.reminders.getOverdueStats(tenantId),
      this.prisma.callLog.count({
        where: {
          tenantId,
          qualification: null,
          createdAt: { gte: new Date(now.getTime() - 2 * 3600_000) },
        },
      }),
    ]);

    for (const s of overdueStats) {
      if (s.overdueCount >= 3)
        alerts.push(`⚠️ ${s.agent?.firstName} ${s.agent?.lastName} : ${s.overdueCount} rappels en retard.`);
    }
    if (unqualified > 10)
      alerts.push(`⚠️ ${unqualified} appels non qualifiés dans les 2 dernières heures.`);

    return alerts;
  }

  // ── Résumé quotidien ──────────────────────────────────────────────────────

  async getDailySummary(ctx: AgentContext): Promise<string> {
    const snap = await this._snapshot(ctx);
    return this.llm.chat([
      { role: 'system', content: `Assistant CRM. ${snap}. Réponds en français, max 3 points courts.` },
      { role: 'user',   content: 'Briefing de début de journée.' },
    ]);
  }

  // ── Historique ────────────────────────────────────────────────────────────

  async getHistory(userId: string, tenantId: string, limit = 50) {
    return this.prisma.chatMessage
      .findMany({
        where:   { userId, tenantId },
        orderBy: { createdAt: 'desc' },
        take:    limit,
      })
      .then((m) => m.reverse());
  }

  async clearHistory(userId: string, tenantId: string) {
    return this.prisma.chatMessage.deleteMany({ where: { userId, tenantId } });
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  private _buildMessages(
    ctx:         AgentContext,
    snap:        string,
    history:     LlmMessage[],
    userMessage: string,
  ): LlmMessage[] {
    return [
      {
        role:    'system',
        content: `Assistant CRM LNAYCRM. Agent: ${ctx.firstName}. ${snap}. Réponds en français, max 2 phrases.`,
      },
      ...history,
      { role: 'user', content: userMessage },
    ];
  }

  /** Snapshot compact CRM (< 60 mots) */
  private async _snapshot(ctx: AgentContext): Promise<string> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [remCount, calls, sales] = await Promise.all([
      this.prisma.reminder.count({
        where: { userId: ctx.userId, isDone: false, dueAt: { lte: new Date(Date.now() + 24 * 3600_000) } },
      }),
      this.prisma.callLog.count({
        where: { tenantId: ctx.tenantId, agentId: ctx.userId, createdAt: { gte: today } },
      }),
      this.prisma.callLog.count({
        where: { tenantId: ctx.tenantId, agentId: ctx.userId, qualification: 'SALE', createdAt: { gte: today } },
      }),
    ]);
    return `Rappels en attente: ${remCount}. Appels aujourd'hui: ${calls}. Ventes: ${sales}`;
  }

  private async _getHistory(userId: string, tenantId: string, limit: number): Promise<LlmMessage[]> {
    const msgs = await this.prisma.chatMessage.findMany({
      where:   { userId, tenantId, role: { in: ['user', 'assistant'] } },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { role: true, content: true },
    });
    return msgs.reverse().map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  }

  /** Fire-and-forget — ne jamais await cette méthode */
  private _persistMessages(ctx: AgentContext, userMsg: string, assistantMsg: string): void {
    Promise.all([
      this.prisma.chatMessage.create({
        data: { tenantId: ctx.tenantId, userId: ctx.userId, role: 'user',      content: userMsg },
      }),
      this.prisma.chatMessage.create({
        data: { tenantId: ctx.tenantId, userId: ctx.userId, role: 'assistant', content: assistantMsg },
      }),
    ]).catch(() => {/* non bloquant */});
  }

  private _parseIntent(msg: string): 'list_reminders' | null {
    if (/mes rappels|liste.*rappel|rappels.*aujourd|quels.*rappel/i.test(msg)) return 'list_reminders';
    return null;
  }
}
