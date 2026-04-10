import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import { REDIS_PUB_CLIENT, REDIS_SUB_CLIENT } from '../../redis/redis.module';

// ── Types d'événements ────────────────────────────────────────────────────────

export type BusEventType =
  | 'call.started'
  | 'call.ended'
  | 'call.qualified'
  | 'agent.status.changed'
  | 'agent.state.changed'
  | 'supervision.alert'
  | 'dialer.started'
  | 'dialer.stopped'
  | 'planning.request.approved';

export interface BusEvent<T = unknown> {
  type:      BusEventType;
  tenantId:  string;
  payload:   T;
  emittedAt: string;   // ISO string
  instanceId: string;  // identifiant de l'instance qui publie
}

// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL = 'lnaycrm:events';
const INSTANCE_ID = `${process.pid}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * EventBusService — Bus d'événements Redis Pub/Sub
 *
 * Architecture :
 *   Module calls/supervision/crm → publish(event)
 *                                       ↓
 *                               Redis PUBLISH lnaycrm:events
 *                                       ↓
 *   Tous les instances NestJS ← subscribe → re-émettent via EventEmitter2 local
 *
 * Avantage : EventEmitter2 continue de fonctionner in-process.
 * Redis Pub/Sub ajoute la communication cross-instance (scalabilité horizontale).
 *
 * Note : les événements publiés par l'instance courante sont ignorés côté sub
 * (dédupliqués par instanceId) pour éviter le double-traitement.
 */
@Injectable()
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    @Inject(REDIS_PUB_CLIENT) private readonly pub: Redis,
    @Inject(REDIS_SUB_CLIENT) private readonly sub: Redis,
    private readonly emitter: EventEmitter2,
  ) {}

  onModuleInit() {
    this.sub.subscribe(CHANNEL, (err) => {
      if (err) {
        this.logger.error(`[EventBus] Échec subscribe: ${err.message}`);
      } else {
        this.logger.log(`[EventBus] Abonné au canal "${CHANNEL}" (instance=${INSTANCE_ID})`);
      }
    });

    this.sub.on('message', (_channel: string, message: string) => {
      try {
        const event: BusEvent = JSON.parse(message);

        // Ignorer les événements publiés par CETTE instance (déjà émis localement)
        if (event.instanceId === INSTANCE_ID) return;

        this.logger.debug(`[EventBus] Reçu cross-instance: ${event.type} tenant=${event.tenantId}`);

        // Re-émettre dans l'EventEmitter2 local pour que les handlers existants fonctionnent
        this.emitter.emit(event.type, event.payload);
      } catch (err: any) {
        this.logger.error(`[EventBus] Erreur parsing message: ${err.message}`);
      }
    });
  }

  // ── API publique ──────────────────────────────────────────────────────────

  async publish<T>(type: BusEventType, tenantId: string, payload: T): Promise<void> {
    const event: BusEvent<T> = {
      type,
      tenantId,
      payload,
      emittedAt:  new Date().toISOString(),
      instanceId: INSTANCE_ID,
    };

    // 1. Émettre localement (in-process, synchrone)
    this.emitter.emit(type, payload);

    // 2. Publier sur Redis (cross-instance, async)
    await this.pub.publish(CHANNEL, JSON.stringify(event));

    this.logger.debug(`[EventBus] Publié: ${type} tenant=${tenantId}`);
  }

  /** Raccourci pour les événements call center courants */
  async callStarted(tenantId: string, data: { callId: string; agentId: string; leadId?: string }) {
    return this.publish('call.started', tenantId, data);
  }

  async callEnded(tenantId: string, data: { callId: string; agentId: string; callLogId?: string }) {
    return this.publish('call.ended', tenantId, data);
  }

  async callQualified(tenantId: string, data: { callLogId: string; agentId: string; qualification: string }) {
    return this.publish('call.qualified', tenantId, data);
  }

  async agentStatusChanged(tenantId: string, data: { agentId: string; status: string; log?: any }) {
    return this.publish('agent.status.changed', tenantId, data);
  }

  async supervisionAlert(tenantId: string, data: { supervisorId: string; agentId: string; action: string }) {
    return this.publish('supervision.alert', tenantId, data);
  }
}
