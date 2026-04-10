import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, SetMetadata } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { SupervisionService } from './supervision.service';
import { WsRolesGuard, WS_ROLES_KEY } from '../../common/guards/ws-roles.guard';

const SUPERVISOR_ROLES = ['ADMIN', 'MANAGER'];

export interface PrivateChatMessage {
  id:            string;
  fromId:        string;
  fromName:      string;
  toId:          string;    // agentId (manager→agent) ou managerId (agent→manager)
  tenantId:      string;
  content:       string;
  sentAt:        string;
  direction:     'manager_to_agent' | 'agent_to_manager';
}

interface SpyData {
  supervisorExtension: string;
  targetExtension: string;
  mode: 'listen' | 'whisper' | 'barge';
}

/**
 * Gateway Socket.io — /supervision
 *
 * Rooms :
 *   sup:{tenantId}       → tous les superviseurs du tenant
 *   agents:{tenantId}    → tous les agents connectés (supervision)
 *   agent:{agentId}      → messages ciblés à un agent (supervision ns)
 *   manager:{managerId}  → réponses privées reçues par ce manager
 *
 * Chat privé manager↔agent :
 *   manager → sup:private:send { toAgentId, content }
 *           → EventEmitter2 "chat.private.message"
 *           → CallsGateway → socket agent dans /telephony
 *
 *   agent  → agent:chat:reply dans /telephony
 *          → EventEmitter2 "chat.private.reply"
 *          → ici → socket manager dans manager:{managerId}
 */
@UseGuards(WsRolesGuard)
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/supervision' })
export class SupervisionGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(SupervisionGateway.name);

  constructor(
    private readonly supervisionSvc: SupervisionService,
    private readonly events: EventEmitter2,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Supervision WS: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const meta = client.data as any;
    if (meta?.userId) {
      this.logger.debug(`Supervision WS déconnecté: userId=${meta.userId}`);
    }
  }

  // ── Inscription ────────────────────────────────────────────

  @SubscribeMessage('sup:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; tenantId: string; role: string; name: string },
  ) {
    if (!data?.userId || !data?.tenantId) return;

    client.data = {
      userId:   data.userId,
      tenantId: data.tenantId,
      role:     data.role,
      name:     data.name,
    };

    if (SUPERVISOR_ROLES.includes(data.role)) {
      client.join([`sup:${data.tenantId}`, `agents:${data.tenantId}`, `manager:${data.userId}`]);
    } else {
      client.join([`agents:${data.tenantId}`, `agent:${data.userId}`]);
    }

    client.emit('sup:joined', { ok: true });
    this.logger.log(`Supervision: ${data.name} (${data.role}) rejoint tenant=${data.tenantId}`);
    return { ok: true };
  }

  // ── ChanSpy ────────────────────────────────────────────────

  @SubscribeMessage('sup:spy')
  @SetMetadata(WS_ROLES_KEY, SUPERVISOR_ROLES)
  async handleSpy(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SpyData,
  ) {
    const meta = client.data as any;
    try {
      const session = await this.supervisionSvc.startSpy(meta.userId, data.supervisorExtension, data.targetExtension, data.mode);
      client.emit('sup:spy:started', session);
      this.server.to(`sup:${meta.tenantId}`).emit('sup:spy:update', {
        supervisorId:    meta.userId,
        supervisorName:  meta.name,
        targetExtension: data.targetExtension,
        mode:            data.mode,
        startedAt:       new Date().toISOString(),
      });
      this.logger.log(`[SPY] ${data.mode.toUpperCase()}: supervisor=${meta.userId} → ext=${data.targetExtension}`);
    } catch (err: any) {
      client.emit('sup:error', { message: err.message });
    }
  }

  @SubscribeMessage('sup:spy:switch')
  @SetMetadata(WS_ROLES_KEY, SUPERVISOR_ROLES)
  async handleSwitchMode(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { mode: 'listen' | 'whisper' | 'barge' },
  ) {
    const meta = client.data as any;
    const session = await this.supervisionSvc.switchMode(meta.userId, data.mode);
    client.emit('sup:spy:started', session);
    this.logger.log(`[SPY SWITCH] → ${data.mode}: supervisor=${meta.userId}`);
  }

  @SubscribeMessage('sup:spy:stop')
  @SetMetadata(WS_ROLES_KEY, SUPERVISOR_ROLES)
  async handleStopSpy(@ConnectedSocket() client: Socket) {
    const meta = client.data as any;
    await this.supervisionSvc.stopSpy(meta.userId);
    client.emit('sup:spy:stopped', { ok: true });
    this.logger.log(`[SPY STOP]: supervisor=${meta.userId}`);
  }

  // ── Chat privé manager → agent (restreint ADMIN/MANAGER) ──

  @SubscribeMessage('sup:private:send')
  @SetMetadata(WS_ROLES_KEY, SUPERVISOR_ROLES)
  handlePrivateSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toAgentId: string; content: string },
  ) {
    const meta = client.data as any;
    if (!data?.toAgentId || !data.content?.trim()) return;

    const msg: PrivateChatMessage = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      fromId:    meta.userId,
      fromName:  meta.name,
      toId:      data.toAgentId,
      tenantId:  meta.tenantId,
      content:   data.content.trim(),
      sentAt:    new Date().toISOString(),
      direction: 'manager_to_agent',
    };

    // Confirmer l'envoi au manager
    client.emit('sup:private:sent', msg);

    // Bridge cross-namespace → CallsGateway livrera au socket agent dans /telephony
    this.events.emit('chat.private.message', msg);

    this.logger.debug(`[Chat] Manager ${meta.userId} → agent ${data.toAgentId}`);
  }

  // ── Réception réponse agent (depuis CallsGateway via EventEmitter2) ─────────

  @OnEvent('chat.private.reply')
  onAgentReply(msg: PrivateChatMessage) {
    // Livrer au manager concerné dans la room manager:{managerId}
    this.server.to(`manager:${msg.toId}`).emit('sup:private:reply', msg);
    this.logger.debug(`[Chat] Agent ${msg.fromId} → manager ${msg.toId} (réponse)`);
  }

  // ── Legacy sup:message (broadcast équipe) — conservé pour compatibilité ──────

  @SubscribeMessage('sup:message')
  handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toAgentId?: string; content: string },
  ) {
    const meta = client.data as any;
    if (!meta?.userId || !data.content?.trim()) return;

    const msg = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fromId:    meta.userId,
      fromName:  meta.name,
      toAgentId: data.toAgentId,
      content:   data.content.trim(),
      sentAt:    new Date().toISOString(),
    };

    if (data.toAgentId) {
      this.server.to(`agent:${data.toAgentId}`).emit('sup:message:received', msg);
      client.emit('sup:message:sent', msg);
    } else {
      this.server.to(`agents:${meta.tenantId}`).emit('sup:message:received', msg);
    }
  }

  // ── Events AMI / dialer ────────────────────────────────────

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

  broadcastToSupervisors(tenantId: string, event: string, data: any) {
    this.server.to(`sup:${tenantId}`).emit(event, data);
  }
}
