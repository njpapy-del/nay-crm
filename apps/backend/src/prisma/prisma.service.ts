import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Database connected');
    } catch (e: any) {
      this.logger.warn(`Database connect failed at startup (will retry on first query): ${e?.message}`);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
