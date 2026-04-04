import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { AmiService } from './asterisk/ami.service';
import { OriginateCallDto, UpdateCallDto } from './dto/originate-call.dto';
import { CallStatus } from '@prisma/client';

const CALL_SELECT = {
  id: true, direction: true, status: true, callerNumber: true, calleeNumber: true,
  duration: true, startedAt: true, answeredAt: true, endedAt: true, notes: true,
  asteriskId: true, recordingUrl: true,
  agent: { select: { id: true, firstName: true, lastName: true } },
  client: { select: { id: true, firstName: true, lastName: true, company: true } },
} as const;

@Injectable()
export class CallsService {
  private readonly logger = new Logger(CallsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ami: AmiService,
  ) {}

  // ── Historique ─────────────────────────────────────────────

  async findAll(tenantId: string, params: { agentId?: string; status?: string; limit?: number; skip?: number }) {
    const { agentId, status, limit = 50, skip = 0 } = params;
    const where = {
      tenantId,
      ...(agentId ? { agentId } : {}),
      ...(status ? { status: status as CallStatus } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.call.findMany({ where, select: CALL_SELECT, orderBy: { startedAt: 'desc' }, take: limit, skip }),
      this.prisma.call.count({ where }),
    ]);
    return { data, meta: { total, limit, skip } };
  }

  async findOne(tenantId: string, id: string) {
    const call = await this.prisma.call.findFirst({ where: { id, tenantId }, select: CALL_SELECT });
    if (!call) throw new NotFoundException('Appel introuvable');
    return call;
  }

  // ── Stats ──────────────────────────────────────────────────

  async stats(tenantId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [total, answered, todayTotal, avgDuration] = await Promise.all([
      this.prisma.call.count({ where: { tenantId } }),
      this.prisma.call.count({ where: { tenantId, status: 'ANSWERED' } }),
      this.prisma.call.count({ where: { tenantId, startedAt: { gte: today } } }),
      this.prisma.call.aggregate({ where: { tenantId, status: 'ANSWERED' }, _avg: { duration: true } }),
    ]);
    return {
      total,
      answered,
      answerRate: total > 0 ? Math.round((answered / total) * 100) : 0,
      todayTotal,
      avgDuration: Math.round(avgDuration._avg.duration ?? 0),
    };
  }

  // ── Originate (clic → appel) ───────────────────────────────

  async originateCall(tenantId: string, userId: string, dto: OriginateCallDto) {
    const call = await this.prisma.call.create({
      data: {
        tenantId,
        agentId: userId,
        clientId: dto.clientId,
        direction: 'OUTBOUND',
        status: 'RINGING',
        callerNumber: dto.agentExtension,
        calleeNumber: dto.destination,
      },
      select: CALL_SELECT,
    });

    try {
      await this.ami.originate({
        channel: `PJSIP/${dto.agentExtension}`,
        exten: dto.destination,
        context: 'outbound',
        callerID: `LNAYCRM <${dto.agentExtension}>`,
        variables: { LNAYCRM_CALL_ID: call.id, LNAYCRM_TENANT_ID: tenantId },
      });
    } catch (err: any) {
      this.logger.error(`Originate échoué: ${err?.message ?? err}`);
      await this.prisma.call.update({ where: { id: call.id }, data: { status: 'FAILED', endedAt: new Date() } });
      throw err;
    }

    return call;
  }

  async update(tenantId: string, id: string, dto: UpdateCallDto) {
    await this.findOne(tenantId, id);
    return this.prisma.call.update({
      where: { id },
      data: { ...dto, status: dto.status as CallStatus | undefined },
      select: CALL_SELECT,
    });
  }

  async hangup(tenantId: string, id: string) {
    const call = await this.findOne(tenantId, id);
    if (call.asteriskId) await this.ami.hangup(call.asteriskId);
    return this.prisma.call.update({ where: { id }, data: { status: 'CANCELLED', endedAt: new Date() }, select: CALL_SELECT });
  }

  // ── Webhook Asterisk (hangup handler) ─────────────────────

  async handleHangupWebhook(payload: {
    uniqueid: string; duration: string; disposition: string;
    callerid: string; dest: string;
  }) {
    const call = await this.prisma.call.findFirst({ where: { asteriskId: payload.uniqueid } });
    if (!call) return;
    const statusMap: Record<string, CallStatus> = {
      ANSWERED: 'ANSWERED', BUSY: 'BUSY', 'NO ANSWER': 'NO_ANSWER', FAILED: 'FAILED',
    };
    await this.prisma.call.update({
      where: { id: call.id },
      data: {
        status: statusMap[payload.disposition.toUpperCase()] ?? 'FAILED',
        duration: parseInt(payload.duration, 10) || 0,
        endedAt: new Date(),
      },
    });
    this.logger.log(`Appel ${call.id} terminé — ${payload.disposition} (${payload.duration}s)`);
  }

  // ── AMI Events ────────────────────────────────────────────

  @OnEvent('ami.Newchannel')
  async onNewChannel(event: Record<string, string>) {
    this.logger.debug(`Newchannel: ${event.Channel} — ${event.CallerIDNum} → ${event.Exten}`);
  }

  @OnEvent('ami.Hangup')
  async onHangup(event: Record<string, string>) {
    this.logger.debug(`Hangup: ${event.Channel} cause=${event.Cause}`);
  }

  @OnEvent('ami.AgentConnect')
  async onAgentConnect(event: Record<string, string>) {
    this.logger.log(`Agent connecté: ${event.MemberName} queue=${event.Queue}`);
  }
}
