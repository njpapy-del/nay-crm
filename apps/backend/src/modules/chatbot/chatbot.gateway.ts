import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayInit, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';

@WebSocketGateway({ namespace: '/chatbot', cors: { origin: '*' } })
export class ChatbotGateway implements OnGatewayInit {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatbotGateway.name);

  constructor(private readonly chatbot: ChatbotService) {}

  afterInit() { this.logger.log('Chatbot Gateway ready'); }

  // ── Rejoindre la salle personnelle ────────────────────────────────────────

  @SubscribeMessage('join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    client.join(`agent:${data.userId}`);
    client.data.userId = data.userId;
    this.logger.debug(`Agent ${data.userId} rejoint le canal chatbot`);
  }

  // ── Message chat avec streaming ───────────────────────────────────────────
  // Protocole :
  //   client → emit('chat:message', { message, userId, tenantId, firstName, role })
  //   server → emit('chat:token', { token })        — pour chaque fragment
  //   server → emit('chat:done')                    — quand terminé
  //   server → emit('chat:error', { message })      — en cas d'erreur

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      message:   string;
      userId:    string;
      tenantId:  string;
      firstName: string;
      role:      string;
    },
  ) {
    if (!data.message?.trim() || !data.userId || !data.tenantId) return;

    const ctx = {
      userId:    data.userId,
      tenantId:  data.tenantId,
      firstName: data.firstName ?? 'Agent',
      role:      data.role      ?? 'AGENT',
    };

    try {
      await this.chatbot.sendMessageStream(
        ctx,
        data.message,
        (token) => client.emit('chat:token', { token }),
      );
      client.emit('chat:done');
    } catch (err: any) {
      this.logger.error(`chat:message error: ${err.message}`);
      client.emit('chat:error', { message: 'Erreur lors du traitement. Veuillez réessayer.' });
    }
  }

  // ── Rappel échu — push vers l'agent concerné ─────────────────────────────

  @OnEvent('reminder.due')
  handleReminderDue(payload: {
    userId:   string;
    tenantId: string;
    reminder: { id: string; title: string; dueAt: Date; client?: any };
  }) {
    const { reminder } = payload;
    const clientStr = reminder.client
      ? ` — ${reminder.client.firstName} ${reminder.client.lastName}`
      : '';
    const time = new Date(reminder.dueAt).toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });

    this.server?.to(`agent:${payload.userId}`).emit('reminder:due', {
      type:       'reminder',
      reminderId: reminder.id,
      message:    `🔔 Rappel : ${reminder.title}${clientStr} à ${time}`,
      reminder:   payload.reminder,
    });
  }
}
