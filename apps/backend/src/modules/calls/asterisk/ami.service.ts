import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as net from 'net';

export interface AmiAction {
  Action: string;
  [key: string]: string;
}

export interface AmiEvent {
  Event: string;
  [key: string]: string;
}

/**
 * Client AMI TCP natif — Asterisk Manager Interface
 * Gère connexion, login, envoi d'actions et réception d'events
 */
@Injectable()
export class AmiService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AmiService.name);
  private socket: net.Socket | null = null;
  private buffer = '';
  private actionCallbacks = new Map<string, (res: Record<string, string>) => void>();
  private actionIdCounter = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connected = false;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {}

  onModuleInit() { this.connect(); }
  onModuleDestroy() { this.disconnect(); }

  // ── Connexion ──────────────────────────────────────────────

  private connect() {
    const host = this.config.get('AMI_HOST', '127.0.0.1');
    const port = this.config.get<number>('AMI_PORT', 5038);

    this.socket = new net.Socket();
    this.socket.setEncoding('utf8');

    this.socket.connect(port, host, () => {
      this.logger.log(`AMI connecté à ${host}:${port}`);
    });

    this.socket.on('data', (data: string) => this.handleData(data));
    this.socket.on('error', (err) => this.logger.error(`AMI erreur: ${err.message}`));
    this.socket.on('close', () => this.scheduleReconnect());
  }

  private disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.destroy();
    this.socket = null;
    this.connected = false;
  }

  private scheduleReconnect() {
    this.connected = false;
    this.logger.warn('AMI déconnecté — reconnexion dans 5s');
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  // ── Parser AMI ────────────────────────────────────────────

  private handleData(raw: string) {
    this.buffer += raw;
    const blocks = this.buffer.split('\r\n\r\n');
    this.buffer = blocks.pop() ?? '';

    for (const block of blocks) {
      const msg = this.parseBlock(block);
      if (!this.connected && block.startsWith('Asterisk Call Manager')) {
        this.connected = true;
        this.login();
        continue;
      }
      if (msg.Response === 'Success' && msg.ActionID) {
        this.actionCallbacks.get(msg.ActionID)?.(msg);
        this.actionCallbacks.delete(msg.ActionID);
      }
      if (msg.Event) {
        this.events.emit(`ami.${msg.Event}`, msg);
      }
    }
  }

  private parseBlock(block: string): Record<string, string> {
    return block.split('\r\n').reduce<Record<string, string>>((acc, line) => {
      const idx = line.indexOf(': ');
      if (idx > -1) acc[line.slice(0, idx)] = line.slice(idx + 2);
      return acc;
    }, {});
  }

  // ── Login ─────────────────────────────────────────────────

  private login() {
    this.sendRaw({
      Action: 'Login',
      Username: this.config.get('AMI_USERNAME', 'lnaycrm'),
      Secret: this.config.get('AMI_SECRET', 'AMI_LNAYCRM_SECRET_2024!'),
    });
    this.logger.log('AMI login envoyé');
  }

  // ── Actions ───────────────────────────────────────────────

  sendAction(action: AmiAction): Promise<Record<string, string>> {
    const ActionID = `lnay-${++this.actionIdCounter}`;
    return new Promise((resolve, reject) => {
      this.actionCallbacks.set(ActionID, resolve);
      setTimeout(() => {
        this.actionCallbacks.delete(ActionID);
        reject(new Error(`AMI timeout ActionID=${ActionID}`));
      }, 10_000);
      this.sendRaw({ ...action, ActionID });
    });
  }

  private sendRaw(action: Record<string, string>) {
    if (!this.socket || !this.socket.writable) {
      this.logger.warn('AMI socket non disponible');
      return;
    }
    const msg = Object.entries(action).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n';
    this.socket.write(msg);
  }

  // ── Helpers publics ───────────────────────────────────────

  async originate(params: {
    channel: string; exten: string; context: string;
    priority?: string; callerID?: string; timeout?: number;
    variables?: Record<string, string>;
  }) {
    const action: AmiAction = {
      Action: 'Originate',
      Channel: params.channel,
      Exten: params.exten,
      Context: params.context,
      Priority: params.priority ?? '1',
      CallerID: params.callerID ?? params.exten,
      Timeout: String((params.timeout ?? 30) * 1000),
      Async: 'true',
    };
    if (params.variables) {
      action.Variable = Object.entries(params.variables).map(([k, v]) => `${k}=${v}`).join(',');
    }
    return this.sendAction(action);
  }

  async hangup(channel: string) {
    return this.sendAction({ Action: 'Hangup', Channel: channel });
  }

  async getChannels() {
    return this.sendAction({ Action: 'CoreShowChannels' });
  }

  async queueAdd(queue: string, iface: string, membername: string) {
    return this.sendAction({ Action: 'QueueAdd', Queue: queue, Interface: iface, MemberName: membername });
  }

  async queueRemove(queue: string, iface: string) {
    return this.sendAction({ Action: 'QueueRemove', Queue: queue, Interface: iface });
  }

  isConnected() { return this.connected; }
}
