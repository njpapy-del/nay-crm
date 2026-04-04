import {
  Injectable, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { FilterRecordingsDto, SyncRecordingDto } from './dto/recording.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);
  private readonly basePath: string;
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.basePath = this.config.get<string>('RECORDINGS_PATH') ?? '/var/spool/asterisk/monitor';
    this.baseUrl  = this.config.get<string>('RECORDINGS_URL')  ?? 'http://localhost:3001/recordings';
  }

  // ── Recherche avancée ─────────────────────────────────

  async findAll(tenantId: string, filters: FilterRecordingsDto) {
    const { agentId, campaignId, phone, dateFrom, dateTo, minDuration, maxDuration,
      format, search, page = 1, limit = 30 } = filters;
    const skip = (page - 1) * limit;

    const where: any = { tenantId, deletedAt: null };
    if (agentId)    where.agentId    = agentId;
    if (campaignId) where.campaignId = campaignId;
    if (format)     where.format     = format;
    if (minDuration !== undefined) where.durationSec = { gte: minDuration };
    if (maxDuration !== undefined) where.durationSec = { ...where.durationSec, lte: maxDuration };

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo)   where.createdAt.lte = new Date(dateTo);
    }

    if (phone) {
      where.OR = [
        { callerNumber: { contains: phone } },
        { calleeNumber: { contains: phone } },
      ];
    }

    if (search) {
      const agentWhere = {
        agent: {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName:  { contains: search, mode: 'insensitive' } },
          ],
        },
      };
      where.AND = [agentWhere];
    }

    const [data, total] = await Promise.all([
      this.prisma.recording.findMany({
        where, skip, take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          agent:    { select: { id: true, firstName: true, lastName: true } },
          campaign: { select: { id: true, name: true } },
          call:     { select: { id: true, direction: true, status: true, disposition: true } },
          _count:   { select: { accessLogs: true } },
        },
      }),
      this.prisma.recording.count({ where }),
    ]);

    return {
      data: data.map((r) => ({ ...r, url: this.buildUrl(r.fileName) })),
      total, page, limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(tenantId: string, id: string) {
    const rec = await this.prisma.recording.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        agent:    { select: { id: true, firstName: true, lastName: true } },
        campaign: { select: { id: true, name: true } },
        call: {
          include: {
            client: { select: { id: true, firstName: true, lastName: true, phone: true } },
            lead:   { select: { id: true, firstName: true, lastName: true, phone: true } },
          },
        },
        accessLogs: {
          orderBy: { createdAt: 'desc' }, take: 20,
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!rec) throw new NotFoundException('Enregistrement introuvable');
    return { ...rec, url: this.buildUrl(rec.fileName) };
  }

  /** Sync depuis Asterisk (appelé via webhook ou cron) */
  async syncFromAsterisk(tenantId: string, dto: SyncRecordingDto) {
    const call = await this.prisma.call.findFirst({ where: { id: dto.callId, tenantId } });
    if (!call) throw new NotFoundException('Appel introuvable');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    return this.prisma.recording.upsert({
      where: { callId: dto.callId },
      create: {
        tenantId,
        callId:      dto.callId,
        agentId:     call.agentId ?? null,
        campaignId:  null,
        fileName:    dto.fileName,
        filePath:    dto.filePath,
        fileSize:    dto.fileSize ?? null,
        format:      dto.format ?? 'WAV',
        durationSec: dto.durationSec ?? 0,
        callerNumber: call.callerNumber,
        calleeNumber: call.calleeNumber,
        asteriskId:  dto.asteriskId ?? null,
        expiresAt,
      },
      update: {
        fileName: dto.fileName, filePath: dto.filePath,
        fileSize: dto.fileSize ?? null,
        durationSec: dto.durationSec ?? 0,
        format: dto.format ?? 'WAV',
      },
    });
  }

  /** Scan répertoire Asterisk et synchronise les fichiers non encore indexés */
  async scanAndSync(tenantId: string): Promise<{ found: number; synced: number }> {
    if (!fs.existsSync(this.basePath)) {
      this.logger.warn(`Répertoire Asterisk introuvable: ${this.basePath}`);
      return { found: 0, synced: 0 };
    }

    const files = fs.readdirSync(this.basePath)
      .filter((f) => /\.(wav|mp3|ogg)$/i.test(f));

    const existing = new Set(
      (await this.prisma.recording.findMany({ where: { tenantId }, select: { fileName: true } }))
        .map((r) => r.fileName),
    );

    let synced = 0;
    for (const file of files) {
      if (existing.has(file)) continue;
      const fullPath = path.join(this.basePath, file);
      const stat = fs.statSync(fullPath);
      const expiresAt = new Date(stat.mtime);
      expiresAt.setDate(expiresAt.getDate() + 60);

      const ext = path.extname(file).slice(1).toUpperCase() as 'WAV' | 'MP3' | 'OGG';
      await this.prisma.recording.create({
        data: {
          tenantId, callId: `orphan-${file}`, fileName: file,
          filePath: fullPath, fileSize: stat.size,
          format: ['WAV', 'MP3', 'OGG'].includes(ext) ? ext : 'WAV',
          callerNumber: 'unknown', calleeNumber: 'unknown',
          expiresAt,
        },
      }).catch(() => {});
      synced++;
    }

    return { found: files.length, synced };
  }

  /** Retourne le chemin absolu du fichier pour streaming/download */
  getFilePath(tenantId: string, id: string): Promise<{ filePath: string; fileName: string; format: string }> {
    return this.prisma.recording.findFirst({
      where: { id, tenantId, deletedAt: null },
      select: { filePath: true, fileName: true, format: true },
    }).then((rec) => {
      if (!rec) throw new NotFoundException('Enregistrement introuvable');
      if (!fs.existsSync(rec.filePath)) throw new NotFoundException('Fichier audio introuvable');
      return rec;
    });
  }

  /** Log accès (lecture / téléchargement) */
  async logAccess(tenantId: string, recordingId: string, userId: string, action: string, ip?: string) {
    await this.prisma.recordingAccessLog.create({
      data: { tenantId, recordingId, userId, action, ip: ip ?? null },
    });
  }

  /** Supprimer enregistrements expirés (cron 60j) */
  async purgeExpired(): Promise<number> {
    const expired = await this.prisma.recording.findMany({
      where: { expiresAt: { lte: new Date() }, deletedAt: null },
      select: { id: true, filePath: true },
    });

    let deleted = 0;
    for (const rec of expired) {
      try {
        if (fs.existsSync(rec.filePath)) fs.unlinkSync(rec.filePath);
        await this.prisma.recording.update({
          where: { id: rec.id },
          data: { deletedAt: new Date() },
        });
        deleted++;
      } catch (err: any) {
        this.logger.error(`Purge failed for ${rec.id}: ${err.message}`);
      }
    }

    this.logger.log(`Purge: ${deleted}/${expired.length} enregistrements supprimés`);
    return deleted;
  }

  async remove(tenantId: string, id: string) {
    const rec = await this.findOne(tenantId, id);
    if (fs.existsSync(rec.filePath)) fs.unlinkSync(rec.filePath);
    await this.prisma.recording.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  private buildUrl(fileName: string) {
    return `${this.baseUrl}/${fileName}`;
  }
}
