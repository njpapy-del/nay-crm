import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayInit, MessageBody, ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/chatbot', cors: { origin: '*' } })
export class ChatbotGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(ChatbotGateway.name);

  afterInit() { this.logger.log('Chatbot Gateway ready'); }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() client: Socket, @MessageBody() data: { userId: string }) {
    client.join(`agent:${data.userId}`);
    this.logger.debug(`Agent ${data.userId} rejoint le canal chatbot`);
  }

  // Reçoit l'événement du cron RemindersService et pousse vers le client
  @OnEvent('reminder.due')
  handleReminderDue(payload: {
    userId: string;
    tenantId: string;
    reminder: { id: string; title: string; dueAt: Date; client?: any };
  }) {
    const { reminder } = payload;
    const clientStr = reminder.client
      ? ` — ${reminder.client.firstName} ${reminder.client.lastName}`
      : '';
    const time = new Date(reminder.dueAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    this.server?.to(`agent:${payload.userId}`).emit('reminder:due', {
      type: 'reminder',
      reminderId: reminder.id,
      message: `🔔 Rappel : ${reminder.title}${clientStr} à ${time}`,
      reminder: payload.reminder,
    });
  }
}
