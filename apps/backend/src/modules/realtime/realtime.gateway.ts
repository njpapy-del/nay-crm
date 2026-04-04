import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { RealtimeService } from './realtime.service';

const BROADCAST_INTERVAL_MS = 3_000;  // snapshot toutes les 3s

/**
 * Gateway Socket.io — /realtime
 * Diffuse le snapshot global toutes les 3s + sur chaque événement AMI
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);
  private broadcastTimers = new Map<string, NodeJS.Timeout>();  // tenantId → timer
  private subscribedTenants = new Set<string>();

  constructor(private readonly realtimeSvc: RealtimeService) {}

  handleConnection(client: Socket) {
    this.logger.debug(`Realtime WS: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Le timer s'arrête uniquement s'il n'y a plus d'abonnés dans la room
  }

  // ── Subscribe ─────────────────────────────────────────────

  @SubscribeMessage('rt:subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    const { tenantId } = data;
    client.join(`rt:${tenantId}`);

    const snapshot = await this.realtimeSvc.getSnapshot(tenantId);
    client.emit('rt:snapshot', snapshot);

    if (!this.subscribedTenants.has(tenantId)) {
      this.subscribedTenants.add(tenantId);
      this.startBroadcast(tenantId);
    }

    return { ok: true };
  }

  @SubscribeMessage('rt:unsubscribe')
  handleUnsubscribe(@ConnectedSocket() client: Socket, @MessageBody() data: { tenantId: string }) {
    client.leave(`rt:${data.tenantId}`);
  }

  // ── Broadcast périodique ──────────────────────────────────

  private startBroadcast(tenantId: string) {
    const timer = setInterval(async () => {
      if (!this.server?.sockets?.adapter) return;
      const room = this.server.sockets.adapter.rooms.get(`rt:${tenantId}`);
      if (!room || room.size === 0) {
        clearInterval(timer);
        this.broadcastTimers.delete(tenantId);
        this.subscribedTenants.delete(tenantId);
        return;
      }
      try {
        const snapshot = await this.realtimeSvc.getSnapshot(tenantId);
        this.server.to(`rt:${tenantId}`).emit('rt:snapshot', snapshot);
      } catch (err: any) {
        this.logger.error(`Broadcast error: ${err.message}`);
      }
    }, BROADCAST_INTERVAL_MS);

    this.broadcastTimers.set(tenantId, timer);
  }

  // ── Push immédiat sur événements AMI ─────────────────────

  @OnEvent('agent.state.changed')
  async onAgentStateChanged(data: any) {
    if (!data.tenantId) return;
    await this.pushSnapshot(data.tenantId);
  }

  @OnEvent('dialer.call.initiated')
  async onDialerCall(data: any) {
    const call = await this.realtimeSvc.getCached(data.tenantId ?? '');
    if (call) this.server.to(`rt:${call.tenantId}`).emit('rt:snapshot', call);
  }

  @OnEvent('ami.Newchannel')
  @OnEvent('ami.Hangup')
  @OnEvent('ami.AgentConnect')
  async onAmiEvent() {
    for (const tenantId of this.subscribedTenants) {
      await this.pushSnapshot(tenantId);
    }
  }

  private async pushSnapshot(tenantId: string) {
    try {
      const snapshot = await this.realtimeSvc.getSnapshot(tenantId);
      this.server.to(`rt:${tenantId}`).emit('rt:snapshot', snapshot);
    } catch { /* ignore */ }
  }
}
