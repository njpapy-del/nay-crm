import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StorageService, StorageBucket } from './storage.service';

const VALID_BUCKETS: StorageBucket[] = ['recordings', 'exports', 'files'];

@Controller('storage')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StorageController {
  constructor(private readonly svc: StorageService) {}

  // ── Upload ────────────────────────────────────────────────────

  @Post('upload/:bucket')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Param('bucket') bucket: string,
    @Query('folder') folder?: string,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }

    return this.svc.upload(
      {
        buffer:       file.buffer,
        mimetype:     file.mimetype,
        size:         file.size,
        originalname: file.originalname,
      },
      bucket as StorageBucket,
      folder,
    );
  }

  // ── Download stream ───────────────────────────────────────────

  @Get('download/:bucket/:key(*)')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  async download(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
    @Res() res: Response,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }

    const exists = await this.svc.exists(bucket as StorageBucket, key);
    if (!exists) throw new NotFoundException('Fichier introuvable');

    const stream = await this.svc.getStream(bucket as StorageBucket, key);
    res.setHeader('Content-Disposition', `attachment; filename="${key.split('/').pop()}"`);
    (stream as NodeJS.ReadableStream).pipe(res);
  }

  // ── Signed URL (private download) ────────────────────────────

  @Get('signed-url/:bucket/:key(*)')
  @Roles('ADMIN', 'MANAGER', 'AGENT')
  async signedUrl(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
    @Query('expires') expires?: string,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }

    const expiresInSec = expires ? parseInt(expires, 10) : 3600;
    const url = await this.svc.getSignedUrl(bucket as StorageBucket, key, expiresInSec);
    return { url, expiresInSec };
  }

  // ── Presigned upload URL ──────────────────────────────────────

  @Post('presign/:bucket')
  @Roles('ADMIN', 'MANAGER')
  async presignUpload(
    @Param('bucket') bucket: string,
    @Query('key') key: string,
    @Query('mimeType') mimeType: string,
    @Query('expires') expires?: string,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }
    if (!key || !mimeType) {
      throw new BadRequestException('key et mimeType sont requis');
    }

    const expiresInSec = expires ? parseInt(expires, 10) : 300;
    const url = await this.svc.getUploadSignedUrl(bucket as StorageBucket, key, mimeType, expiresInSec);
    return { url, key, expiresInSec };
  }

  // ── List ──────────────────────────────────────────────────────

  @Get('list/:bucket')
  @Roles('ADMIN', 'MANAGER')
  async list(
    @Param('bucket') bucket: string,
    @Query('prefix') prefix?: string,
    @Query('maxKeys') maxKeys?: string,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }

    return this.svc.list(
      bucket as StorageBucket,
      prefix,
      maxKeys ? parseInt(maxKeys, 10) : 100,
    );
  }

  // ── Delete ────────────────────────────────────────────────────

  @Delete(':bucket/:key(*)')
  @Roles('ADMIN', 'MANAGER')
  async delete(
    @Param('bucket') bucket: string,
    @Param('key') key: string,
  ) {
    if (!VALID_BUCKETS.includes(bucket as StorageBucket)) {
      throw new BadRequestException(`Bucket invalide: ${bucket}`);
    }

    await this.svc.delete(bucket as StorageBucket, key);
    return { deleted: true, key };
  }
}
