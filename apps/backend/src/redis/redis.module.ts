import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): Redis => {
        return new Redis({
          host:               cfg.get<string>('REDIS_HOST', 'localhost'),
          port:               cfg.get<number>('REDIS_PORT', 6379),
          password:           cfg.get<string>('REDIS_PASSWORD') || undefined,
          db:                 cfg.get<number>('REDIS_CACHE_DB', 1),
          lazyConnect:        false,
          enableOfflineQueue: true,
          retryStrategy:      (times) => Math.min(times * 500, 5_000),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
