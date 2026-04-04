import {
  Controller, Get, Post, Delete, Param, Query, Body,
  UseGuards, Res, HttpStatus, Req,
} from '@nestjs/common';
import { Response, Request } from 'express';
import * as fs from 'fs';
import { RecordingsService } from './recordings.service';
import { FilterRecordingsDto, SyncRecordingDto } from './dto/recording.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('recordings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecordingsController {
  constructor(private readonly service: RecordingsService) {}

  @Get()
  @Roles('ADMIN', 'MANAGER')
  findAll(@CurrentUser() user: any, @Query() filters: FilterRecordingsDto) {
    return this.service.findAll(user.tenantId, filters);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.findOne(user.tenantId, id);
  }

  /** Stream audio pour player navigateur */
  @Get(':id/stream')
  @Roles('ADMIN', 'MANAGER')
  async stream(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { filePath, format } = await this.service.getFilePath(user.tenantId, id);
    await this.service.logAccess(user.tenantId, id, user.id, 'play', req.ip);

    const mime = format === 'MP3' ? 'audio/mpeg' : format === 'OGG' ? 'audio/ogg' : 'audio/wav';
    const stat = fs.statSync(filePath);
    const range = req.headers.range;

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunkSize,
        'Content-Type':   mime,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': stat.size,
        'Content-Type':   mime,
        'Accept-Ranges':  'bytes',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  }

  /** Téléchargement direct */
  @Get(':id/download')
  @Roles('ADMIN', 'MANAGER')
  async download(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { filePath, fileName } = await this.service.getFilePath(user.tenantId, id);
    await this.service.logAccess(user.tenantId, id, user.id, 'download', req.ip);
    res.download(filePath, fileName);
  }

  /** Sync depuis Asterisk via webhook */
  @Post('sync')
  @Public()
  syncFromAsterisk(@Body() body: { tenantId: string } & SyncRecordingDto) {
    const { tenantId, ...dto } = body;
    return this.service.syncFromAsterisk(tenantId, dto);
  }

  /** Scan manuel du répertoire Asterisk */
  @Post('scan')
  @Roles('ADMIN')
  scan(@CurrentUser() user: any) {
    return this.service.scanAndSync(user.tenantId);
  }

  /** Supprimer manuellement */
  @Delete(':id')
  @Roles('ADMIN')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.service.remove(user.tenantId, id);
  }

  /** Déclencher purge manuellement */
  @Post('purge')
  @Roles('ADMIN')
  async purge() {
    const deleted = await this.service.purgeExpired();
    return { deleted };
  }
}
