import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import { Readable } from 'stream';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StorageBucket = 'recordings' | 'exports' | 'files';

export interface UploadResult {
  key:       string;
  bucket:    StorageBucket;
  url:       string;
  size:      number;
  mimeType:  string;
}

export interface StorageFile {
  buffer:   Buffer;
  mimetype: string;
  size:     number;
  originalname: string;
}

// Allowed MIME types per bucket
const ALLOWED_MIME: Record<StorageBucket, RegExp> = {
  recordings: /^audio\//,
  exports:    /^(application\/(pdf|vnd\.openxmlformats|vnd\.ms-|octet-stream)|text\/)/,
  files:      /^(image\/|application\/pdf|text\/)/,
};

const MAX_SIZE_MB: Record<StorageBucket, number> = {
  recordings: 200,
  exports:    50,
  files:      20,
};

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly publicUrl: string;
  private readonly buckets: Record<StorageBucket, string>;

  constructor(private readonly config: ConfigService) {
    const endpoint  = config.get<string>('STORAGE_ENDPOINT');
    const accessKey = config.get<string>('STORAGE_ACCESS_KEY');
    const secretKey = config.get<string>('STORAGE_SECRET_KEY');
    const region    = config.get<string>('STORAGE_REGION') ?? 'us-east-1';

    this.client = new S3Client({
      endpoint,
      region,
      credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
      forcePathStyle: true, // Required for MinIO; ignored by AWS S3
    });

    this.publicUrl = config.get<string>('STORAGE_PUBLIC_URL') ?? endpoint ?? '';

    this.buckets = {
      recordings: config.get<string>('STORAGE_BUCKET_RECORDINGS') ?? 'recordings',
      exports:    config.get<string>('STORAGE_BUCKET_EXPORTS')    ?? 'exports',
      files:      config.get<string>('STORAGE_BUCKET_FILES')      ?? 'files',
    };
  }

  // ── Upload ────────────────────────────────────────────────────────────────

  async upload(file: StorageFile, bucket: StorageBucket, folder?: string): Promise<UploadResult> {
    this._validateFile(file, bucket);

    const ext = file.originalname.split('.').pop() ?? 'bin';
    const key = [folder, `${uuidv4()}.${ext}`].filter(Boolean).join('/');

    await this.client.send(new PutObjectCommand({
      Bucket:      this.buckets[bucket],
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      Metadata: { originalName: encodeURIComponent(file.originalname) },
    }));

    this.logger.log(`Uploaded ${key} to bucket [${bucket}] (${file.size} bytes)`);

    return {
      key,
      bucket,
      url:      this._publicUrl(bucket, key),
      size:     file.size,
      mimeType: file.mimetype,
    };
  }

  // ── Get (stream) ──────────────────────────────────────────────────────────

  async getStream(bucket: StorageBucket, key: string): Promise<Readable> {
    const res = await this.client.send(new GetObjectCommand({
      Bucket: this.buckets[bucket],
      Key:    key,
    }));
    return res.Body as Readable;
  }

  // ── Signed URL (time-limited, private access) ─────────────────────────────

  async getSignedUrl(bucket: StorageBucket, key: string, expiresInSec = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.buckets[bucket],
      Key:    key,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  // ── Signed URL for upload (PUT) ───────────────────────────────────────────

  async getUploadSignedUrl(
    bucket: StorageBucket,
    key: string,
    mimeType: string,
    expiresInSec = 300,
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket:      this.buckets[bucket],
      Key:         key,
      ContentType: mimeType,
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSec });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async delete(bucket: StorageBucket, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.buckets[bucket],
      Key:    key,
    }));
    this.logger.log(`Deleted ${key} from bucket [${bucket}]`);
  }

  // ── Exists ────────────────────────────────────────────────────────────────

  async exists(bucket: StorageBucket, key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: this.buckets[bucket],
        Key:    key,
      }));
      return true;
    } catch {
      return false;
    }
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(bucket: StorageBucket, prefix?: string, maxKeys = 100) {
    const res = await this.client.send(new ListObjectsV2Command({
      Bucket: this.buckets[bucket],
      Prefix: prefix,
      MaxKeys: maxKeys,
    }));
    return (res.Contents ?? []).map(obj => ({
      key:          obj.Key!,
      size:         obj.Size,
      lastModified: obj.LastModified,
      url:          this._publicUrl(bucket, obj.Key!),
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  publicUrlOf(bucket: StorageBucket, key: string): string {
    return this._publicUrl(bucket, key);
  }

  private _publicUrl(bucket: StorageBucket, key: string): string {
    return `${this.publicUrl}/${this.buckets[bucket]}/${key}`;
  }

  private _validateFile(file: StorageFile, bucket: StorageBucket) {
    const maxBytes = MAX_SIZE_MB[bucket] * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `Fichier trop volumineux (max ${MAX_SIZE_MB[bucket]} Mo pour le bucket ${bucket})`,
      );
    }
    if (!ALLOWED_MIME[bucket].test(file.mimetype)) {
      throw new BadRequestException(`Type de fichier non autorisé pour le bucket ${bucket}: ${file.mimetype}`);
    }
  }
}
