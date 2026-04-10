import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreatePlanningDto, CreateRequestDto, ReviewRequestDto, GetPlanningDto } from './dto/planning.dto';

const AGENT_SELECT = { id: true, firstName: true, lastName: true };

@Injectable()
export class PlanningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  // ── Events (manager creates directly) ─────────────────────────

  async createEvent(tenantId: string, createdById: string, dto: CreatePlanningDto) {
    const event = await this.prisma.agentPlanning.create({
      data: {
        tenantId,
        agentId:     dto.agentId,
        createdById,
        type:        dto.type,
        title:       dto.title,
        startAt:     new Date(dto.startAt),
        endAt:       new Date(dto.endAt),
        notes:       dto.notes,
        status:      'APPROVED',
      },
      include: {
        agent:     { select: AGENT_SELECT },
        createdBy: { select: AGENT_SELECT },
      },
    });
    this.events.emit('planning.event.created', { tenantId, event });
    return event;
  }

  async getEvents(tenantId: string, dto: GetPlanningDto) {
    const where: any = { tenantId };
    if (dto.agentId) where.agentId = dto.agentId;
    if (dto.type)    where.type    = dto.type;
    if (dto.from || dto.to) {
      where.startAt = {
        ...(dto.from ? { gte: new Date(dto.from) } : {}),
        ...(dto.to   ? { lte: new Date(dto.to)   } : {}),
      };
    }
    return this.prisma.agentPlanning.findMany({
      where,
      include: {
        agent:     { select: AGENT_SELECT },
        createdBy: { select: AGENT_SELECT },
      },
      orderBy: { startAt: 'asc' },
    });
  }

  async deleteEvent(tenantId: string, id: string) {
    const ev = await this.prisma.agentPlanning.findFirst({ where: { id, tenantId } });
    if (!ev) throw new NotFoundException('Événement introuvable');
    return this.prisma.agentPlanning.delete({ where: { id } });
  }

  // ── Agent requests ─────────────────────────────────────────────

  async createRequest(tenantId: string, agentId: string, dto: CreateRequestDto) {
    return this.prisma.agentPlanningRequest.create({
      data: {
        tenantId, agentId,
        type:    dto.type,
        title:   dto.title,
        startAt: new Date(dto.startAt),
        endAt:   new Date(dto.endAt),
        motif:   dto.motif,
        status:  'PENDING',
      },
      include: { agent: { select: AGENT_SELECT } },
    });
  }

  async getRequests(tenantId: string, dto: GetPlanningDto) {
    const where: any = { tenantId };
    const agentId = dto.agentId;
    if (agentId) where.agentId = agentId;
    if (dto.status) where.status = dto.status;
    return this.prisma.agentPlanningRequest.findMany({
      where,
      include: {
        agent:      { select: AGENT_SELECT },
        reviewedBy: { select: AGENT_SELECT },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewRequest(tenantId: string, id: string, reviewerId: string, dto: ReviewRequestDto) {
    const req = await this.prisma.agentPlanningRequest.findFirst({ where: { id, tenantId } });
    if (!req) throw new NotFoundException('Demande introuvable');

    const updated = await this.prisma.agentPlanningRequest.update({
      where: { id },
      data: { status: dto.status, reviewedById: reviewerId, reviewedAt: new Date() },
    });

    if (dto.status === 'APPROVED') {
      await this.prisma.agentPlanning.create({
        data: {
          tenantId,
          agentId:     req.agentId,
          createdById: reviewerId,
          type:        req.type,
          title:       req.title,
          startAt:     req.startAt,
          endAt:       req.endAt,
          notes:       req.motif ?? dto.notes,
          status:      'APPROVED',
        },
      });
      this.events.emit('planning.request.approved', { tenantId, requestId: id, agentId: req.agentId });
    }

    return updated;
  }

  async getMyRequests(tenantId: string, agentId: string) {
    return this.prisma.agentPlanningRequest.findMany({
      where: { tenantId, agentId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent:      { select: { id: true, firstName: true, lastName: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
  }
}
