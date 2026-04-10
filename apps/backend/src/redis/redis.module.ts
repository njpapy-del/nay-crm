import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

// ── Tokens d'injection ────────────────────────────────────────────────────────
export const REDIS_CLIENT     = Symbol('REDIS_CLIENT');     // cache général  (DB 1)
export const REDIS_PUB_CLIENT = Symbol('REDIS_PUB_CLIENT'); // pub événements (DB 0)
export const REDIS_SUB_CLIENT = Symbol('REDIS_SUB_CLIENT'); // sub événements (DB 0, connexion dédiée)
// ─────────────────────────────────────────────────────────────────────────────

const makeRedis = (cfg: ConfigService, db: number): Redis =>
  new Redis({
    host:               cfg.get<string>('REDIS_HOST', 'localhost'),
    port:               cfg.get<number>('REDIS_PORT', 6379),
    password:           cfg.get<string>('REDIS_PASSWORD') || undefined,
    db,
    lazyConnect:        false,
    enableOfflineQueue: true,
    retryStrategy:      (times) => Math.min(times * 500, 5_000),
  });

@Global()
@Module({
  providers: [
    {
      provide:    REDIS_CLIENT,
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => makeRedis(cfg, cfg.get<number>('REDIS_CACHE_DB', 1)),
    },
    {
      // Publisher — connexion normale, peut faire SET/GET + PUBLISH
      provide:    REDIS_PUB_CLIENT,
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => makeRedis(cfg, 0),
    },
    {
      // Subscriber — connexion dédiée (ne peut PAS faire d'autres ops en mode subscribe)
      provide:    REDIS_SUB_CLIENT,
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => makeRedis(cfg, 0),
    },
  ],
  exports: [REDIS_CLIENT, REDIS_PUB_CLIENT, REDIS_SUB_CLIENT],
})
export class RedisModule {}
