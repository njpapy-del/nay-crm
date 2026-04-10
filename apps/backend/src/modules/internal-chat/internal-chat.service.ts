import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const MESSAGE_INCLUDE = {
  user: { select: { id: true, firstName: true, lastName: true, role: true } },
} as const;

@Injectable()
export class InternalChatService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Channels ────────────────────────────────────────────────────────────

  async getOrCreateDefaultChannel(tenantId: string, createdById: string) {
    const existing = await this.prisma.internalChannel.findFirst({
      where: { tenantId, isDefault: true },
      include: { _count: { select: { messages: true } } },
    });
    if (existing) return existing;

    return this.prisma.internalChannel.create({
      data: { tenantId, createdById, name: 'Général', isDefault: true, description: 'Canal général de l\'équipe' },
      include: { _count: { select: { messages: true } } },
    });
  }

  async getChannels(tenantId: string) {
    return this.prisma.internalChannel.findMany({
      where: { tenantId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { messages: true } } },
    });
  }

  async createChannel(tenantId: string, createdById: string, name: string, description?: string) {
    return this.prisma.internalChannel.create({
      data: { tenantId, createdById, name, description },
      include: { _count: { select: { messages: true } } },
    });
  }

  // ─── Messages ─────────────────────────────────────────────────────────────

  async getMessages(tenantId: string, channelId: string, limit = 50, before?: string) {
    const where: any = { tenantId, channelId, deletedAt: null };
    if (before) where.createdAt = { lt: new Date(before) };

    const messages = await this.prisma.internalMessage.findMany({
      where,
      include: MESSAGE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return messages.reverse(); // oldest first for display
  }

  async sendMessage(tenantId: string, channelId: string, userId: string, content: string) {
    return this.prisma.internalMessage.create({
      data: { tenantId, channelId, userId, content },
      include: MESSAGE_INCLUDE,
    });
  }

  async editMessage(tenantId: string, messageId: string, userId: string, content: string) {
    return this.prisma.internalMessage.updateMany({
      where: { id: messageId, tenantId, userId },
      data: { content, editedAt: new Date() },
    });
  }

  async deleteMessage(tenantId: string, messageId: string, userId: string, isAdmin: boolean) {
    const where: any = { id: messageId, tenantId };
    if (!isAdmin) where.userId = userId; // agents can only delete own
    return this.prisma.internalMessage.updateMany({
      where,
      data: { deletedAt: new Date() },
    });
  }
}
