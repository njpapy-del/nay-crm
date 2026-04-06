import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AmiService } from './asterisk/ami.service';
import { AgentStateService } from './agent-state.service';
import { MonitoringService } from './monitoring.service';

/**
 * Gateway Socket.io — /telephony
 *
 * Rooms :
 *   tenant:{id}      → tous les connectés du tenant
 *   agent:{id}       → notifications personnelles agent
 *   ext:{extension}  → événements SIP par extension
 *   supervisor:{id}  → dashboard superviseur
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: '/telephony' })
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(CallsGateway.name);
  private socketToAgent = new Map<string, { agentId: string; tenantId: string; extension: string }>();

  constructor(
    private readonly ami: AmiService,
    private readonly agentState: AgentStateService,
    private readonly monitoring: MonitoringService,
  ) {}

  handleConnection(client: Socket) {
    this.logger.debug(`WS connect: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    const meta = this.socketToAgent.get(client.id);
    if (meta) {
      this.agentState.logout(meta.agentId).catch(() => {});
      this.socketToAgent.delete(client.id);
    }
  }

  // ── Agent registration ────────────────────────────────────

  @SubscribeMessage('agent:login')
  async handleAgentLogin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { agentId: string; tenantId: string; extension: string },
  ) {
    this.socketToAgent.set(client.id, data);
    client.join([`tenant:${data.tenantId}`, `agent:${data.agentId}`, `ext:${data.extension}`]);
    const state = await this.agentState.login(data.tenantId, data.agentId, data.extension);
    client.emit('agent:state', state);
    this.broadcastAgentState(data.tenantId, state);
    return { ok: true };
  }

  @SubscribeMessage('agent:logout')
  async handleAgentLogout(@ConnectedSocket() client: Socket) {
    const meta = this.socketToAgent.get(client.id);
    if (!meta) return;
    await this.agentState.logout(meta.agentId);
    this.socketToAgent.delete(client.id);
  }

  @SubscribeMessage('agent:pause')
  async handlePause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { reason?: string },
  ) {
    const meta = this.socketToAgent.get(client.id);
    if (!meta) return;
    const state = await this.agentState.setPaused(meta.agentId, data.reason);
    client.emit('agent:state', state);
    this.broadcastAgentState(meta.tenantId, state);
  }

  @SubscribeMessage('agent:resume')
  async handleResume(@ConnectedSocket() client: Socket) {
    const meta = this.socketToAgent.get(client.id);
    if (!meta) return;
    const state = await this.agentState.setAvailable(meta.agentId);
    client.emit('agent:state', state);
    this.broadcastAgentState(meta.tenantId, state);
  }

  @SubscribeMessage('agent:wrap_up:done')
  async handleWrapUpDone(@ConnectedSocket() client: Socket) {
    const meta = this.socketToAgent.get(client.id);
    if (!meta) return;
    const state = await this.agentState.setAvailable(meta.agentId);
    client.emit('agent:state', state);
    this.broadcastAgentState(meta.tenantId, state);
  }

  // ── Supervisor ────────────────────────────────────────────

  @SubscribeMessage('supervisor:subscribe')
  async handleSupervisorSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    client.join(`supervisor:${data.tenantId}`);
    const snapshot = await this.monitoring.getSnapshot(data.tenantId);
    client.emit('supervisor:snapshot', snapshot);
    return { ok: true };
  }

  // ── Hangup depuis frontend ────────────────────────────────

  @SubscribeMessage('call:hangup')
  async handleHangup(@MessageBody() data: { channel: string }) {
    await this.ami.hangup(data.channel);
  }

  // ── AMI Events → broadcast ────────────────────────────────

  @OnEvent('ami.Newchannel')
  onNewChannel(event: Record<string, string>) {
    const ext = event.Exten;
    this.server.to(`ext:${ext}`).emit('call:ringing', {
      channel: event.Channel,
      callerNumber: event.CallerIDNum,
      callerName: event.CallerIDName,
      extension: ext,
      uniqueid: event.Uniqueid,
    });
  }

  @OnEvent('ami.Hangup')
  onHangup(event: Record<string, string>) {
    const ext = event.ConnectedLineNum;
    this.server.to(`ext:${ext}`).emit('call:hangup', {
      channel: event.Channel,
      cause: event.Cause,
      uniqueid: event.Uniqueid,
    });
  }

  @OnEvent('agent.state.changed')
  async onAgentStateChanged(snap: any) {
    if (!snap.tenantId) return;
    this.broadcastAgentState(snap.tenantId, snap);
    const snapshot = await this.monitoring.getSnapshot(snap.tenantId).catch(() => null);
    if (snapshot) this.server.to(`supervisor:${snap.tenantId}`).emit('supervisor:snapshot', snapshot);
  }

  @OnEvent('dialer.call.initiated')
  onDialerCallInitiated(data: { callId: string; agentId: string; lead: any }) {
    this.server.to(`agent:${data.agentId}`).emit('call:ringing', {
      callId: data.callId,
      lead: data.lead,
      source: 'dialer',
    });
  }

  @OnEvent('dialer.call.answered')
  onDialerCallAnswered(data: { callId: string; agentId: string }) {
    this.server.to(`agent:${data.agentId}`).emit('call:answered', data);
  }

  @OnEvent('dialer.call.ended')
  onDialerCallEnded(data: { callId: string; agentId: string; callLogId?: string }) {
    this.server.to(`agent:${data.agentId}`).emit('call:wrap_up', data);
    this.server.to(`agent:${data.agentId}`).emit('call:postcall', {
      callId: data.callId,
      callLogId: data.callLogId,
      source: 'dialer',
    });
  }

  @OnEvent('dialer.preview')
  onDialerPreview(data: { agentId: string; lead: any; callId: string }) {
    this.server.to(`agent:${data.agentId}`).emit('call:preview', data);
  }

  @OnEvent('agent.status.changed')
  onAgentStatusChanged(data: { tenantId: string; agentId: string; status: string; log: any }) {
    this.server.to(`tenant:${data.tenantId}`).emit('agent:status:update', {
      agentId: data.agentId,
      status:  data.status,
      log:     data.log,
    });
  }

  @OnEvent('planning.request.approved')
  onPlanningApproved(data: { tenantId: string; agentId: string; requestId: string }) {
    this.server.to(`agent:${data.agentId}`).emit('planning:approved', data);
  }

  // ── Helpers ───────────────────────────────────────────────

  private broadcastAgentState(tenantId: string, state: any) {
    this.server.to(`tenant:${tenantId}`).emit('agent:state:update', state);
  }
}
