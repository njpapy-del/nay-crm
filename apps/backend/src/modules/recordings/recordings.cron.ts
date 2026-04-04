import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RecordingsService } from './recordings.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RecordingsCron {
  private readonly logger = new Logger(RecordingsCron.name);

  constructor(
    private readonly recordingsSvc: RecordingsService,
    private readonly prisma: PrismaService,
  ) {}

  /** Suppression quotidienne à 2h du matin */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handlePurge() {
    this.logger.log('Cron: purge enregistrements expirés...');
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    let total = 0;
    for (const t of tenants) {
      total += await this.recordingsSvc.purgeExpired();
    }
    this.logger.log(`Cron: ${total} enregistrement(s) purgés`);
  }

  /** Scan Asterisk toutes les heures pour synchro auto */
  @Cron(CronExpression.EVERY_HOUR)
  async handleScan() {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.recordingsSvc.scanAndSync(t.id).catch(() => {});
    }
  }
}
