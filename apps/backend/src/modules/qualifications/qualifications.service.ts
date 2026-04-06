import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CallQualification, LeadStatus } from '@prisma/client';
import { QualifyCallDto } from './qualifications.dto';

@Injectable()
export class QualificationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
  ) {}

  // ── Main qualify action ──────────────────────────────────────────────────────

  async qualify(tenantId: string, agentId: string, dto: QualifyCallDto) {
    this._validateDate(dto);

    const callLog = await this.prisma.callLog.findFirst({
      where: { id: dto.callLogId, tenantId },
      include: { call: { include: { lead: true, client: true } } },
    });
    if (!callLog) throw new NotFoundException('Journal d\'appel introuvable');
    if (callLog.status === 'QUALIFIED') throw new BadRequestException('Appel déjà qualifié');

    // 1. Update CallLog
    const updated = await this.prisma.callLog.update({
      where: { id: dto.callLogId },
      data: {
        qualification: dto.qualification,
        agentNotes: dto.agentNotes,
        rdvAt: dto.rdvAt ? new Date(dto.rdvAt) : undefined,
        callbackAt: dto.callbackAt ? new Date(dto.callbackAt) : undefined,
        scriptResponseId: dto.scriptResponseId,
        status: 'QUALIFIED',
        qualifiedAt: new Date(),
      },
    });

    // 2. Update Call disposition
    await this.prisma.call.update({
      where: { id: dto.callId },
      data: { disposition: this._toDisposition(dto.qualification) },
    }).catch(() => null);

    // 3. Save note if provided
    if (dto.agentNotes?.trim()) {
      await this.prisma.callNote.create({
        data: { tenantId, callLogId: dto.callLogId, agentId, content: dto.agentNotes },
      });
    }

    // 4. Create appointment if APPOINTMENT
    if (dto.qualification === 'APPOINTMENT' && dto.rdvAt && callLog.call?.lead) {
      await this._createAppointment(tenantId, agentId, callLog, dto.rdvAt);
    }

    // 5. Create reminder if CALLBACK
    if (dto.qualification === 'CALLBACK' && dto.callbackAt) {
      await this._createCallbackReminder(tenantId, agentId, callLog, dto.callbackAt);
    }

    // 6. Update lead/contact status
    await this._updateLeadStatus(callLog.call?.lead?.id, dto.qualification);
    await this._updateContactStatus(callLog.call?.client?.id, dto.qualification);

    // 7. Emit event for realtime
    this.events.emit('call.qualified', { tenantId, agentId, callLogId: dto.callLogId, qualification: dto.qualification });

    return updated;
  }

  // ── Get qualification context for a call ────────────────────────────────────

  async getCallContext(tenantId: string, callId: string) {
    const callLog = await this.prisma.callLog.findFirst({
      where: { callId, tenantId },
      include: {
        call: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, phone: true, company: true } },
            lead:   { select: { id: true, firstName: true, lastName: true, phone: true, campaignId: true } },
          },
        },
        campaign: { select: { id: true, name: true } },
        callNotes: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!callLog) return null;

    // Fetch script for this campaign
    let script: any = null;
    if (callLog.campaignId) {
      script = await this.prisma.script.findFirst({
        where: { tenantId, campaignId: callLog.campaignId, isActive: true },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
    }

    return { callLog, script };
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  async getStats(tenantId: string, campaignId?: string) {
    const where: any = { tenantId, status: 'QUALIFIED' };
    if (campaignId) where.campaignId = campaignId;

    const rows = await this.prisma.callLog.groupBy({
      by: ['qualification'],
      where,
      _count: { _all: true },
    });

    return rows.map((r) => ({ qualification: r.qualification, count: r._count._all }));
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private _validateDate(dto: QualifyCallDto) {
    if (dto.qualification === 'APPOINTMENT' && !dto.rdvAt) {
      throw new BadRequestException('Date de RDV obligatoire pour la qualification APPOINTMENT');
    }
    if (dto.qualification === 'CALLBACK' && !dto.callbackAt) {
      throw new BadRequestException('Date de rappel obligatoire pour la qualification CALLBACK');
    }
  }

  private _toDisposition(q: CallQualification) {
    const map: Partial<Record<CallQualification, string>> = {
      NOT_INTERESTED: 'NOT_INTERESTED',
      CALLBACK: 'CALLBACK',
      WRONG_NUMBER: 'WRONG_NUMBER',
      VOICEMAIL: 'VOICEMAIL',
      DNC: 'DNC',
      SALE: 'SALE',
    };
    return (map[q] ?? 'NOT_INTERESTED') as any;
  }

  private async _createAppointment(tenantId: string, agentId: string, callLog: any, rdvAt: string) {
    const lead = callLog.call?.lead;
    const client = callLog.call?.client;
    const name = lead ? `${lead.firstName} ${lead.lastName}` : client ? `${client.firstName} ${client.lastName}` : 'Contact';

    await this.prisma.appointment.create({
      data: {
        tenantId, agentId,
        clientId: client?.id,
        campaignId: callLog.campaignId,
        title: `RDV — ${name}`,
        startAt: new Date(rdvAt),
        endAt: new Date(new Date(rdvAt).getTime() + 30 * 60000),
        status: 'SCHEDULED',
        description: callLog.agentNotes,
      },
    }).catch(() => null);
  }

  private async _createCallbackReminder(tenantId: string, agentId: string, callLog: any, callbackAt: string) {
    const lead = callLog.call?.lead;
    const client = callLog.call?.client;
    const name = lead ? `${lead.firstName} ${lead.lastName}` : client ? `${client.firstName} ${client.lastName}` : 'Contact';

    await this.prisma.reminder.create({
      data: {
        tenantId, userId: agentId,
        clientId: client?.id,
        title: `Rappel — ${name} (${callLog.calleeNumber})`,
        description: callLog.agentNotes,
        dueAt: new Date(callbackAt),
      },
    }).catch(() => null);
  }

  private async _updateLeadStatus(leadId: string | undefined, q: CallQualification) {
    if (!leadId) return;
    const statusMap: Partial<Record<CallQualification, LeadStatus>> = {
      SALE: 'CONVERTED', APPOINTMENT: 'QUALIFIED',
      NOT_INTERESTED: 'LOST', DNC: 'LOST',
      CALLBACK: 'CONTACTED', OUT_OF_TARGET: 'LOST',
      REFUSAL: 'LOST',
    } as Partial<Record<CallQualification, LeadStatus>>;
    const status = statusMap[q];
    if (status) await this.prisma.lead.update({ where: { id: leadId }, data: { status } }).catch(() => null);
  }

  private async _updateContactStatus(clientId: string | undefined, q: CallQualification) {
    if (!clientId) return;
    // Update the Client record status based on qualification
    const statusMap: Record<string, string> = {
      SALE: 'ACTIVE', DNC: 'DNC', NOT_INTERESTED: 'INACTIVE',
      REFUSAL: 'INACTIVE', OUT_OF_TARGET: 'INACTIVE',
    };
    const status = statusMap[q];
    if (status) await this.prisma.client.update({ where: { id: clientId }, data: { status: status as any } }).catch(() => null);
  }
}
