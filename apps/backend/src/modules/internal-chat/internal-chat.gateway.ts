import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect,
  MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InternalChatService } from './internal-chat.service';

interface AuthPayload {
  sub: string;
  tenantId: string;
  role: string;
  firstName?: string;
  lastName?: string;
}

@WebSocketGateway({ namespace: '/internal-chat', cors: { origin: '*' } })
export class InternalChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(InternalChatGateway.name);

  constructor(
    private readonly chatService: InternalChatService,
    private readonly jwtService: JwtService,
  ) {}

  // ─── Connexion / Déconnexion ──────────────────────────────────────────────

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token ?? client.handshake.query?.token as string;
      const payload: AuthPayload = this.jwtService.verify(token);
      client.data.userId   = payload.sub;
      client.data.tenantId = payload.tenantId;
      client.data.role     = payload.role;
      client.join(`tenant:${payload.tenantId}`);
      this.logger.debug(`[Chat] ${payload.sub} connecté (tenant ${payload.tenantId})`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`[Chat] ${client.data?.userId ?? 'unknown'} déconnecté`);
  }

  // ─── Rejoindre un channel ────────────────────────────────────────────────

  @SubscribeMessage('chat:join')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string },
  ) {
    client.join(`channel:${data.channelId}`);
    // Renvoyer l'historique (50 derniers)
    const messages = await this.chatService.getMessages(client.data.tenantId, data.channelId);
    client.emit('chat:history', messages);
  }

  // ─── Envoyer un message ──────────────────────────────────────────────────

  @SubscribeMessage('chat:send')
  async handleSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string; content: string },
  ) {
    const { userId, tenantId } = client.data;
    if (!data.content?.trim()) return;

    const message = await this.chatService.sendMessage(tenantId, data.channelId, userId, data.content.trim());

    // Diffuser à tout le canal (including sender)
    this.server.to(`channel:${data.channelId}`).emit('chat:message', message);
  }

  // ─── Éditer un message ───────────────────────────────────────────────────

  @SubscribeMessage('chat:edit')
  async handleEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string; content: string },
  ) {
    const { userId, tenantId } = client.data;
    await this.chatService.editMessage(tenantId, data.messageId, userId, data.content);
    this.server.to(`channel:${data.channelId}`).emit('chat:edited', {
      messageId: data.messageId, content: data.content, editedAt: new Date().toISOString(),
    });
  }

  // ─── Supprimer un message ────────────────────────────────────────────────

  @SubscribeMessage('chat:delete')
  async handleDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; channelId: string },
  ) {
    const { userId, tenantId, role } = client.data;
    const isAdmin = role === 'ADMIN' || role === 'MANAGER';
    await this.chatService.deleteMessage(tenantId, data.messageId, userId, isAdmin);
    this.server.to(`channel:${data.channelId}`).emit('chat:deleted', { messageId: data.messageId });
  }

  // ─── Indicateur de frappe ────────────────────────────────────────────────

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { channelId: string; isTyping: boolean },
  ) {
    client.to(`channel:${data.channelId}`).emit('chat:typing', {
      userId: client.data.userId,
      isTyping: data.isTyping,
    });
  }

  // ─── Méthode utilitaire pour broadcast depuis REST ───────────────────────

  broadcastToChannel(channelId: string, event: string, payload: any) {
    this.server.to(`channel:${channelId}`).emit(event, payload);
  }
}
