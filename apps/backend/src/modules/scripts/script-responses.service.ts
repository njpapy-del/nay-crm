import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SaveResponseDto } from './scripts.dto';
import { paginationParams } from '../../common/dto/pagination.dto';

@Injectable()
export class ScriptResponsesService {
  constructor(private prisma: PrismaService) {}

  // ── Save / upsert response for an active call ──────────────────────────────

  async save(tenantId: string, scriptId: string, agentId: string, dto: SaveResponseDto) {
    const script = await this.prisma.script.findFirst({ where: { id: scriptId, tenantId } });
    if (!script) throw new NotFoundException('Script introuvable');

    // Find or create the response record
    let response = await this.prisma.scriptResponse.findFirst({
      where: {
        scriptId, agentId, tenantId,
        ...(dto.callId ? { callId: dto.callId } : {}),
        isComplete: false,
      },
    });

    if (!response) {
      response = await this.prisma.scriptResponse.create({
        data: {
          tenantId, scriptId, agentId,
          callId: dto.callId,
          contactId: dto.contactId,
          campaignId: dto.campaignId ?? script.campaignId,
          isComplete: dto.isComplete ?? false,
        },
      });
    } else if (dto.isComplete !== undefined || dto.contactId || dto.callId) {
      response = await this.prisma.scriptResponse.update({
        where: { id: response.id },
        data: {
          isComplete: dto.isComplete ?? response.isComplete,
          contactId: dto.contactId ?? response.contactId,
          callId: dto.callId ?? response.callId,
        },
      });
    }

    // Upsert each value
    await Promise.all(
      Object.entries(dto.values ?? {}).map(([fieldId, value]) =>
        this.prisma.scriptResponseValue.upsert({
          where: { responseId_fieldId: { responseId: response!.id, fieldId } },
          create: { responseId: response!.id, fieldId, value: value as any },
          update: { value: value as any },
        }),
      ),
    );

    return this.prisma.scriptResponse.findUnique({
      where: { id: response.id },
      include: { values: { include: { field: { select: { id: true, label: true, type: true } } } } },
    });
  }

  // ── Get history for a script ───────────────────────────────────────────────

  async getHistory(tenantId: string, scriptId: string, query: any) {
    const { skip, take } = paginationParams(query);
    const where: any = { scriptId, tenantId };
    if (query.agentId) where.agentId = query.agentId;
    if (query.callId) where.callId = query.callId;
    if (query.isComplete !== undefined) where.isComplete = query.isComplete === 'true';

    const [data, total] = await Promise.all([
      this.prisma.scriptResponse.findMany({
        where, skip, take,
        orderBy: { createdAt: 'desc' },
        include: {
          agent: { select: { id: true, firstName: true, lastName: true } },
          values: { include: { field: { select: { id: true, label: true, type: true, order: true } } } },
        },
      }),
      this.prisma.scriptResponse.count({ where }),
    ]);

    return { data, total, page: query.page ?? 1, limit: take };
  }

  // ── Get a single response ──────────────────────────────────────────────────

  async findOne(tenantId: string, responseId: string) {
    const r = await this.prisma.scriptResponse.findFirst({
      where: { id: responseId, tenantId },
      include: {
        script: { include: { fields: { orderBy: { order: 'asc' } } } },
        agent: { select: { id: true, firstName: true, lastName: true } },
        values: { include: { field: true } },
      },
    });
    if (!r) throw new NotFoundException('Réponse introuvable');
    return r;
  }

  // ── Get active response for a call ─────────────────────────────────────────

  async getActiveForCall(tenantId: string, callId: string, scriptId: string) {
    return this.prisma.scriptResponse.findFirst({
      where: { callId, scriptId, tenantId, isComplete: false },
      include: {
        values: { include: { field: true } },
      },
    });
  }
}
