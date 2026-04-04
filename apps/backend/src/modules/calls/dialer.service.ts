import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AmiService } from './asterisk/ami.service';
import { AgentStateService } from './agent-state.service';

export type DialerMode = 'PROGRESSIVE' | 'PREDICTIVE' | 'PREVIEW';

export interface DialerSession {
  campaignId: string;
  tenantId: string;
  mode: DialerMode;
  active: boolean;
  ratio: number;           // predictive: appels par agent disponible
  wrapUpTime: number;      // secondes avant next dial
}

/**
 * Moteur de numérotation automatique
 *
 * PROGRESSIVE  : 1 appel → attend agent libre → appelle
 * PREDICTIVE   : N appels simultanés selon ratio agents libres
 * PREVIEW      : agent voit la fiche avant d'accepter l'appel
 */
@Injectable()
export class DialerService implements OnModuleDestroy {
  private readonly logger = new Logger(DialerService.name);
  private sessions = new Map<string, DialerSession>();  // campaignId → session
  private dialTimer: NodeJS.Timeout | null = null;
  private readonly TICK_MS = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly ami: AmiService,
    private readonly agentState: AgentStateService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleDestroy() {
    if (this.dialTimer) clearInterval(this.dialTimer);
  }

  // ── Contrôle sessions ─────────────────────────────────────

  startCampaign(campaignId: string, tenantId: string, mode: DialerMode = 'PROGRESSIVE', ratio = 1.2) {
    if (this.sessions.has(campaignId)) {
      this.sessions.get(campaignId)!.active = true;
      return;
    }
    this.sessions.set(campaignId, { campaignId, tenantId, mode, active: true, ratio, wrapUpTime: 10 });
    this.logger.log(`Dialer démarré: campaign=${campaignId} mode=${mode}`);
    if (!this.dialTimer) this.startTick();
    this.events.emit('dialer.started', { campaignId, mode });
  }

  stopCampaign(campaignId: string) {
    const session = this.sessions.get(campaignId);
    if (session) {
      session.active = false;
      this.logger.log(`Dialer arrêté: campaign=${campaignId}`);
      this.events.emit('dialer.stopped', { campaignId });
    }
  }

  getActiveSessions() {
    return [...this.sessions.values()].filter((s) => s.active);
  }

  // ── Tick principal ────────────────────────────────────────

  private startTick() {
    this.dialTimer = setInterval(() => this.tick(), this.TICK_MS);
  }

  private async tick() {
    for (const session of this.sessions.values()) {
      if (!session.active) continue;
      try { await this.processSession(session); }
      catch (err: any) { this.logger.error(`Dialer tick error: ${err.message}`); }
    }
  }

  private async processSession(session: DialerSession) {
    const available = await this.agentState.getAvailable(session.tenantId);
    if (available.length === 0) return;

    const callsToMake = this.computeCallCount(session, available.length);
    const leads = await this.getNextLeads(session.campaignId, session.tenantId, callsToMake);
    if (leads.length === 0) {
      this.logger.log(`Campagne ${session.campaignId} : plus de leads`);
      this.stopCampaign(session.campaignId);
      return;
    }

    for (let i = 0; i < Math.min(leads.length, available.length); i++) {
      await this.dialLead(leads[i], available[i], session);
    }
  }

  private computeCallCount(session: DialerSession, agentCount: number): number {
    if (session.mode === 'PROGRESSIVE') return agentCount;
    if (session.mode === 'PREDICTIVE') return Math.ceil(agentCount * session.ratio);
    return agentCount; // PREVIEW
  }

  // ── Dial ──────────────────────────────────────────────────

  private async dialLead(lead: any, agent: any, session: DialerSession) {
    const call = await this.prisma.call.create({
      data: {
        tenantId: session.tenantId,
        agentId: agent.agentId,
        leadId: lead.id,
        direction: 'OUTBOUND',
        status: 'RINGING',
        callerNumber: agent.extension,
        calleeNumber: lead.phone,
      },
    });

    await this.agentState.setRinging(agent.agentId, call.id);
    await this.prisma.lead.update({ where: { id: lead.id }, data: { status: 'CONTACTED' } });

    if (session.mode === 'PREVIEW') {
      this.events.emit('dialer.preview', { agentId: agent.agentId, lead, callId: call.id });
      return;
    }

    try {
      await this.ami.originate({
        channel: `PJSIP/${agent.extension}`,
        exten: lead.phone,
        context: 'outbound',
        callerID: `LNAYCRM CRM <${agent.extension}>`,
        timeout: 30,
        variables: {
          LNAYCRM_CALL_ID: call.id,
          LNAYCRM_LEAD_ID: lead.id,
          LNAYCRM_AGENT_EXT: agent.extension,
        },
      });
      this.logger.log(`Dial: agent=${agent.extension} → ${lead.phone} (lead=${lead.id})`);
      this.events.emit('dialer.call.initiated', { callId: call.id, agentId: agent.agentId, lead });
    } catch (err: any) {
      this.logger.error(`Originate échoué: ${err.message}`);
      await this.prisma.call.update({ where: { id: call.id }, data: { status: 'FAILED', endedAt: new Date() } });
      await this.agentState.setAvailable(agent.agentId);
    }
  }

  // ── Leads ─────────────────────────────────────────────────

  private async getNextLeads(campaignId: string, tenantId: string, limit: number) {
    return this.prisma.lead.findMany({
      where: {
        campaignId,
        tenantId,
        status: 'NEW',
        phone: { not: null },
      },
      take: limit,
      orderBy: { createdAt: 'asc' },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true, company: true },
    });
  }

  // ── AMI Events → transitions état ─────────────────────────

  @OnEvent('ami.AgentConnect')
  async onAgentConnect(event: Record<string, string>) {
    const callId = event.Variable_LNAYCRM_CALL_ID;
    if (!callId) return;
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call?.agentId) return;
    await this.prisma.call.update({ where: { id: callId }, data: { status: 'ANSWERED', answeredAt: new Date() } });
    await this.agentState.setInCall(call.agentId, callId);
    this.events.emit('dialer.call.answered', { callId, agentId: call.agentId });
  }

  @OnEvent('ami.Hangup')
  async onHangup(event: Record<string, string>) {
    const callId = event.Variable_LNAYCRM_CALL_ID;
    if (!callId) return;
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call?.agentId) return;
    await this.agentState.setWrapUp(call.agentId);
    this.events.emit('dialer.call.ended', { callId, agentId: call.agentId });
  }
}
