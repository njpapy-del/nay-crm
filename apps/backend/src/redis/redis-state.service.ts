import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.module';

/**
 * RedisStateService — couche hot data pour le call center
 *
 * Schema des clés (DB 1) :
 *   agent:state:{agentId}          → JSON AgentStateSnapshot,  TTL 2h
 *   agent:available:{tenantId}     → SET d'agentIds disponibles
 *   agent:pending_qual:{agentId}   → callLogId string,          TTL 4h
 *   dialer:session:{campaignId}    → JSON DialerSession,        pas de TTL (géré manuellement)
 *   ws:rate:{agentId}:{windowSec}  → compteur events WS,        TTL = windowSec
 */
@Injectable()
export class RedisStateService {
  private readonly logger = new Logger(RedisStateService.name);

  // TTLs
  private readonly AGENT_STATE_TTL        = 7_200;   // 2 heures
  private readonly PENDING_QUAL_TTL       = 14_400;  // 4 heures
  private readonly RATE_WINDOW_SEC        = 1;       // fenêtre rate-limit
  private readonly RATE_MAX_EVENTS        = 10;      // max events / windowSec

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  // ── Agent state ─────────────────────────────────────────────────────────────

  async setAgentState(agentId: string, snapshot: object): Promise<void> {
    const key = `agent:state:${agentId}`;
    await this.redis.setex(key, this.AGENT_STATE_TTL, JSON.stringify(snapshot));
  }

  async getAgentState(agentId: string): Promise<Record<string, any> | null> {
    const raw = await this.redis.get(`agent:state:${agentId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async deleteAgentState(agentId: string): Promise<void> {
    await this.redis.del(`agent:state:${agentId}`);
  }

  // ── Agents disponibles par tenant ───────────────────────────────────────────
  // Maintient un SET Redis des agentIds disponibles — SMEMBERS = O(n) garanti rapide

  async markAvailable(tenantId: string, agentId: string): Promise<void> {
    await this.redis.sadd(`agent:available:${tenantId}`, agentId);
  }

  async markUnavailable(tenantId: string, agentId: string): Promise<void> {
    await this.redis.srem(`agent:available:${tenantId}`, agentId);
  }

  async getAvailableAgentIds(tenantId: string): Promise<string[]> {
    return this.redis.smembers(`agent:available:${tenantId}`);
  }

  async isAvailable(tenantId: string, agentId: string): Promise<boolean> {
    return (await this.redis.sismember(`agent:available:${tenantId}`, agentId)) === 1;
  }

  // ── Qualification post-appel ────────────────────────────────────────────────

  async setPendingQualification(agentId: string, callLogId: string): Promise<void> {
    await this.redis.setex(`agent:pending_qual:${agentId}`, this.PENDING_QUAL_TTL, callLogId);
    // Retirer de la liste des disponibles pendant la qualification
    // (le tenantId est inconnu ici — géré dans AgentStateService)
    this.logger.debug(`[PendingQual] SET agent=${agentId} callLog=${callLogId}`);
  }

  async getPendingQualification(agentId: string): Promise<string | null> {
    return this.redis.get(`agent:pending_qual:${agentId}`);
  }

  async clearPendingQualification(agentId: string): Promise<void> {
    await this.redis.del(`agent:pending_qual:${agentId}`);
    this.logger.debug(`[PendingQual] CLEAR agent=${agentId}`);
  }

  async hasPendingQualification(agentId: string): Promise<boolean> {
    return (await this.redis.exists(`agent:pending_qual:${agentId}`)) === 1;
  }

  // ── Dialer sessions (remplace la Map in-memory) ─────────────────────────────

  async setDialerSession(campaignId: string, session: object): Promise<void> {
    await this.redis.set(`dialer:session:${campaignId}`, JSON.stringify(session));
  }

  async getDialerSession(campaignId: string): Promise<Record<string, any> | null> {
    const raw = await this.redis.get(`dialer:session:${campaignId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async deleteDialerSession(campaignId: string): Promise<void> {
    await this.redis.del(`dialer:session:${campaignId}`);
  }

  async getAllDialerSessionKeys(): Promise<string[]> {
    return this.redis.keys('dialer:session:*');
  }

  // ── Rate limiting WebSocket ─────────────────────────────────────────────────
  // Algorithme : sliding window counter avec INCR + EXPIRE

  async checkRateLimit(agentId: string): Promise<boolean> {
    const key = `ws:rate:${agentId}:${Math.floor(Date.now() / 1_000 / this.RATE_WINDOW_SEC)}`;
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, this.RATE_WINDOW_SEC + 1);
    }
    if (count > this.RATE_MAX_EVENTS) {
      this.logger.warn(`[RateLimit] BLOCKED agent=${agentId} count=${count}`);
      return false; // bloqué
    }
    return true; // autorisé
  }

  // ── Nettoyage (appelé par le cron) ─────────────────────────────────────────

  async cleanupAgentAvailableSet(tenantId: string, validAgentIds: string[]): Promise<void> {
    const key = `agent:available:${tenantId}`;
    const current = await this.redis.smembers(key);
    const stale = current.filter((id) => !validAgentIds.includes(id));
    if (stale.length > 0) {
      await this.redis.srem(key, ...stale);
      this.logger.log(`[Cleanup] Supprimé ${stale.length} agents obsolètes du SET tenant=${tenantId}`);
    }
  }

  async flushAllAgentState(): Promise<void> {
    const keys = await this.redis.keys('agent:state:*');
    if (keys.length > 0) await this.redis.del(...keys);
  }
}
