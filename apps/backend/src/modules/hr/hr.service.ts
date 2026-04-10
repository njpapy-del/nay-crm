import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateHrRequestDto, ReviewHrRequestDto, HrRequestQueryDto, AttendanceQueryDto } from './dto/hr.dto';

const REQUEST_INCLUDE = {
  agent: { select: { id: true, firstName: true, lastName: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true } },
};

@Injectable()
export class HrService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Demandes d'absence ────────────────────────────────────

  async createRequest(tenantId: string, agentId: string, dto: CreateHrRequestDto) {
    const request = await this.prisma.hrRequest.create({
      data: {
        tenantId,
        agentId,
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        comment: dto.comment,
      },
      include: REQUEST_INCLUDE,
    });
    return { data: request };
  }

  async findRequests(tenantId: string, q: HrRequestQueryDto, skip = 0, limit = 20) {
    const where: any = { tenantId };
    if (q.agentId) where.agentId = q.agentId;
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.from || q.to) {
      where.startDate = {};
      if (q.from) where.startDate.gte = new Date(q.from);
      if (q.to) where.startDate.lte = new Date(q.to);
    }
    const [data, total] = await Promise.all([
      this.prisma.hrRequest.findMany({ where, include: REQUEST_INCLUDE, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      this.prisma.hrRequest.count({ where }),
    ]);
    return { data, meta: { total, skip, limit } };
  }

  async reviewRequest(tenantId: string, id: string, reviewedById: string, dto: ReviewHrRequestDto) {
    const req = await this.prisma.hrRequest.findFirst({ where: { id, tenantId } });
    if (!req) throw new NotFoundException('Demande introuvable');
    if (req.status !== 'PENDING') throw new ForbiddenException('Demande déjà traitée');

    const updated = await this.prisma.hrRequest.update({
      where: { id },
      data: { status: dto.status, reviewedById, reviewedAt: new Date(), reviewComment: dto.reviewComment },
      include: REQUEST_INCLUDE,
    });
    return { data: updated };
  }

  async deleteRequest(tenantId: string, id: string, agentId: string) {
    const req = await this.prisma.hrRequest.findFirst({ where: { id, tenantId, agentId } });
    if (!req) throw new NotFoundException('Demande introuvable');
    if (req.status !== 'PENDING') throw new ForbiddenException('Impossible de supprimer une demande traitée');
    await this.prisma.hrRequest.delete({ where: { id } });
    return { ok: true };
  }

  // ── Présence ──────────────────────────────────────────────

  async getAttendance(tenantId: string, q: AttendanceQueryDto) {
    const where: any = { tenantId };
    if (q.agentId) where.agentId = q.agentId;
    if (q.from || q.to) {
      where.date = {};
      if (q.from) where.date.gte = new Date(q.from);
      if (q.to) where.date.lte = new Date(q.to);
    }
    const data = await this.prisma.hrAttendance.findMany({
      where,
      include: { agent: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ date: 'desc' }, { agentId: 'asc' }],
    });
    return { data };
  }

  // ── Dashboard RH ──────────────────────────────────────────

  async getDashboard(tenantId: string, from: string, to: string) {
    const dateRange = { gte: new Date(from), lte: new Date(to) };

    const [requests, attendances, agents] = await Promise.all([
      this.prisma.hrRequest.findMany({ where: { tenantId, startDate: dateRange }, include: REQUEST_INCLUDE }),
      this.prisma.hrAttendance.findMany({ where: { tenantId, date: dateRange } }),
      this.prisma.user.findMany({
        where: { tenantId, role: { in: ['AGENT', 'QUALITY', 'QUALITY_SUPERVISOR'] } },
        select: { id: true, firstName: true, lastName: true },
      }),
    ]);

    const reqByStatus = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
    const reqByType: Record<string, number> = {};
    for (const r of requests) {
      reqByStatus[r.status as keyof typeof reqByStatus]++;
      reqByType[r.type] = (reqByType[r.type] ?? 0) + 1;
    }

    const totalHours = attendances.reduce((s, a) => s + a.hoursWorked, 0);
    const presentDays = attendances.filter((a) => a.isPresent).length;

    return {
      data: {
        period: { from, to },
        agents: agents.length,
        requests: { total: requests.length, ...reqByStatus, byType: reqByType },
        attendance: { totalHours: +totalHours.toFixed(1), presentDays },
      },
    };
  }

  // ── Agenda partagé ────────────────────────────────────────

  async getAgenda(tenantId: string, from: string, to: string, agentId?: string) {
    const where: any = { tenantId, startDate: { gte: new Date(from), lte: new Date(to) } };
    if (agentId) where.agentId = agentId;
    const data = await this.prisma.hrRequest.findMany({
      where: { ...where, status: 'APPROVED' },
      include: REQUEST_INCLUDE,
      orderBy: { startDate: 'asc' },
    });
    return { data };
  }
}
