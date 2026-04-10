import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { AmiService } from '../calls/asterisk/ami.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SpyMode } from './dto/spy.dto';

/** Sessions d'espionnage actives (en mémoire) */
export interface SpySession {
  supervisorId: string;
  supervisorExtension: string;
  targetExtension: string;
  mode: SpyMode;
  channel?: string;
  logId?: string;
  startedAt: Date;
}

/**
 * Service supervision — ChanSpy via AMI
 *
 * Originate sur l'extension du superviseur → contexte [supervision]
 * Le dialplan exécute ChanSpy(PJSIP/<agent>, flags)
 */
@Injectable()
export class SupervisionService {
  private readonly logger = new Logger(SupervisionService.name);
  private spySessions = new Map<string, SpySession>(); // supervisorId → session

  constructor(
    private readonly ami: AmiService,
    private readonly prisma: PrismaService,
  ) {}

  // ── ChanSpy ───────────────────────────────────────────────

  async startSpy(supervisorId: string, supervisorExtension: string, targetExtension: string, mode: SpyMode) {
    if (this.spySessions.has(supervisorId)) {
      await this.stopSpy(supervisorId);
    }

    const prefix = this.modePrefix(mode);
    const exten  = `${prefix}${targetExtension}`;

    await this.ami.originate({
      channel: `PJSIP/${supervisorExtension}`,
      exten,
      context: 'supervision',
      callerID: `Supervision <${supervisorExtension}>`,
      timeout: 30,
      variables: {
        SPY_SUPERVISOR_ID: supervisorId,
        SPY_TARGET_EXT: targetExtension,
        SPY_MODE: mode,
      },
    });

    const session: SpySession = { supervisorId, supervisorExtension, targetExtension, mode, startedAt: new Date() };
    this.spySessions.set(supervisorId, session);
    this.logger.log(`SPY ${mode}: superviseur=${supervisorExtension} → agent=${targetExtension}`);

    // Persister le log
    const agentSession = await this.prisma.agentSession.findFirst({ where: { extension: targetExtension } });
    if (agentSession) {
      session.logId = (await (this.prisma as any).callSupervisionLog.create({
        data: {
          tenantId:     agentSession.tenantId,
          supervisorId,
          agentId:      agentSession.agentId,
          action:       mode === 'listen' ? 'LISTEN' : mode === 'whisper' ? 'WHISPER' : 'BARGE',
          startedAt:    new Date(),
        },
      })).id;
    }

    return session;
  }

  async stopSpy(supervisorId: string) {
    const session = this.spySessions.get(supervisorId);
    if (!session) return;
    if (session.channel) {
      await this.ami.hangup(session.channel).catch(() => {});
    }
    // Fermer le log
    if (session.logId) {
      await (this.prisma as any).callSupervisionLog.update({
        where: { id: (session as any).logId },
        data: { endedAt: new Date(), action: 'STOP' },
      }).catch(() => {});
    }
    this.spySessions.delete(supervisorId);
    this.logger.log(`SPY arrêté: superviseur=${session.supervisorExtension}`);
  }

  async switchMode(supervisorId: string, newMode: SpyMode) {
    const session = this.spySessions.get(supervisorId);
    if (!session) throw new BadRequestException('Aucune session active');
    await this.stopSpy(supervisorId);
    return this.startSpy(supervisorId, session.supervisorExtension, session.targetExtension, newMode);
  }

  getActiveSessions(): SpySession[] {
    return [...this.spySessions.values()];
  }

  setChannelForSupervisor(supervisorId: string, channel: string) {
    const session = this.spySessions.get(supervisorId);
    if (session) session.channel = channel;
  }

  // ── Fiche client temps réel ────────────────────────────────

  async getClientCard(callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true, callerNumber: true, calleeNumber: true, direction: true,
        status: true, startedAt: true, answeredAt: true,
        client: {
          select: {
            id: true, firstName: true, lastName: true, company: true,
            email: true, phone: true, status: true, notes: true,
            quotes:   { select: { id: true, number: true, total: true, status: true }, take: 3, orderBy: { createdAt: 'desc' } },
            invoices: { select: { id: true, number: true, total: true, status: true }, take: 3, orderBy: { createdAt: 'desc' } },
          },
        },
        lead: {
          select: {
            id: true, firstName: true, lastName: true, company: true,
            email: true, phone: true, status: true, notes: true,
            campaign: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!call) return null;
    return call;
  }

  // ── Helpers privés ────────────────────────────────────────

  private modePrefix(mode: SpyMode): string {
    return { listen: 'listen-', whisper: 'whisper-', barge: 'barge-' }[mode];
  }
}
