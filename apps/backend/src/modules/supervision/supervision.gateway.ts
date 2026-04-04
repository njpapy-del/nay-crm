import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SupervisionService } from './supervision.service';

interface ChatMessage {
  id: string;
  fromId: string;
  fromName: string;
  toAgentId?: string;
  content: string;
  sentAt: string;
}

/**
 * Gateway Socket.io — /supervision (namespace dédié superviseurs)
 *
 * Rooms :
 *   sup:{tenantId}    → tous les superviseurs du tenant
 *   agents:{tenantId} → tous les agents (reçoivent les messages)
 *   agent:{agentId}   → messages privés à un agent
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/supervision' })
export class SupervisionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SupervisionGateway.name);
  private socketMeta = new Map<string, { userId: string; tenantId: string; role: string; name: string }>();

  constructor(private readonly supervisionSvc: SupervisionService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Supervision WS: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.socketMeta.delete(client.id);
  }

  // ── Authentification ──────────────────────────────────────

  @SubscribeMessage('sup:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; tenantId: string; role: string; name: string },
  ) {
    this.socketMeta.set(client.id, data);

    if (data.role === 'ADMIN' || data.role === 'MANAGER') {
      client.join([`sup:${data.tenantId}`, `agents:${data.tenantId}`]);
    } else {
      client.join([`agents:${data.tenantId}`, `agent:${data.userId}`]);
    }

    client.emit('sup:joined', { ok: true });
    return { ok: true };
  }

  // ── ChanSpy via WS ────────────────────────────────────────

  @SubscribeMessage('sup:spy')
  async handleSpy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { supervisorExtension: string; targetExtension: string; mode: 'listen' | 'whisper' | 'barge' },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    try {
      const session = await this.supervisionSvc.startSpy(meta.userId, data.supervisorExtension, data.targetExtension, data.mode);
      client.emit('sup:spy:started', session);
      this.server.to(`sup:${meta.tenantId}`).emit('sup:spy:update', {
        supervisorId: meta.userId, supervisorName: meta.name,
        targetExtension: data.targetExtension, mode: data.mode,
      });
    } catch (err: any) {
      client.emit('sup:error', { message: err.message });
    }
  }

  @SubscribeMessage('sup:spy:switch')
  async handleSwitchMode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: 'listen' | 'whisper' | 'barge' },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    const session = await this.supervisionSvc.switchMode(meta.userId, data.mode);
    client.emit('sup:spy:started', session);
  }

  @SubscribeMessage('sup:spy:stop')
  async handleStopSpy(@ConnectedSocket() client: Socket) {
    const meta = this.socketMeta.get(client.id);
    if (!meta) return;
    await this.supervisionSvc.stopSpy(meta.userId);
    client.emit('sup:spy:stopped', { ok: true });
  }

  // ── Messagerie interne ────────────────────────────────────

  @SubscribeMessage('sup:message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toAgentId?: string; content: string },
  ) {
    const meta = this.socketMeta.get(client.id);
    if (!meta || !data.content.trim()) return;

    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromId: meta.userId,
      fromName: meta.name,
      toAgentId: data.toAgentId,
      content: data.content.trim(),
      sentAt: new Date().toISOString(),
    };

    if (data.toAgentId) {
      this.server.to(`agent:${data.toAgentId}`).emit('sup:message:received', msg);
      client.emit('sup:message:sent', msg);
    } else {
      this.server.to(`agents:${meta.tenantId}`).emit('sup:message:received', msg);
    }
  }

  // ── Fiche client push automatique ─────────────────────────

  @OnEvent('dialer.call.initiated')
  async onCallInitiated(data: { callId: string; agentId: string; lead: any }) {
    const card = await this.supervisionSvc.getClientCard(data.callId).catch(() => null);
    if (card) {
      this.server.to(`agent:${data.agentId}`).emit('sup:client:card', card);
    }
  }

  @OnEvent('ami.Newchannel')
  onNewChannel(event: Record<string, string>) {
    const spyVar = event['Variable_SPY_SUPERVISOR_ID'];
    if (spyVar) {
      this.supervisionSvc.setChannelForSupervisor(spyVar, event.Channel);
    }
  }

  // ── Broadcast état supervision ─────────────────────────────

  broadcastToSupervisors(tenantId: string, event: string, data: any) {
    this.server.to(`sup:${tenantId}`).emit(event, data);
  }
}
