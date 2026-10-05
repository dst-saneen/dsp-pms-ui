import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

import { Environment } from '../../../config';
import { RecruitmentCryptoService } from '../core/recruitment-crypto.service';
import { resolveS3Endpoint } from './s3-endpoint';

@Injectable()
export class RecruitmentObjectStorageService {
  private readonly logger = new Logger(RecruitmentObjectStorageService.name);
  private readonly uploadRoot: string;
  private readonly nodeEnvironment: Environment['NODE_ENV'];
  private readonly bucket?: string;
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly accessKey?: string;
  private readonly secretKey?: string;
  private readonly storagePrefix: string;

  constructor(
    configService: ConfigService<Environment, true>,
    private readonly crypto: RecruitmentCryptoService,
  ) {
    this.uploadRoot = resolve(
      process.cwd(),
      configService.getOrThrow('RECRUITMENT_UPLOAD_DIR', { infer: true }),
    );
    this.nodeEnvironment = configService.getOrThrow('NODE_ENV', {
      infer: true,
    });
    this.bucket = configService.get('STORAGE_S3_BUCKET', { infer: true });
    this.region = configService.get('STORAGE_S3_REGION', { infer: true }) ?? '';
    if (this.bucket && !this.region) {
      throw new ServiceUnavailableException({
        code: 'RECRUITMENT_STORAGE_UNAVAILABLE',
        message: 'Private object storage region is not configured.',
      });
    }
    this.endpoint = resolveS3Endpoint(
      configService.get('STORAGE_S3_ENDPOINT', {
        infer: true,
      }),
    );
    this.accessKey = configService.get('STORAGE_S3_ACCESS_KEY_ID', {
      infer: true,
    });
    this.secretKey = configService.get('STORAGE_S3_SECRET_ACCESS_KEY', {
      infer: true,
    });
    this.storagePrefix = configService.getOrThrow('STORAGE_S3_PREFIX', {
      infer: true,
    });
    mkdirSync(this.uploadRoot, { recursive: true });
  }

  assertProductionStorageConfigured(): void {
    if (this.nodeEnvironment !== 'production') {
      return;
    }

    if (!this.bucket) {
      throw new ServiceUnavailableException({
        code: 'RECRUITMENT_STORAGE_UNAVAILABLE',
        message: 'Private object storage is not configured.',
      });
    }
  }

  async putObject(storageKey: string, buffer: Buffer): Promise<string> {
    this.assertProductionStorageConfigured();
    const encrypted = this.crypto.encryptBuffer(buffer);
    const objectKey = this.buildPersistentKey(storageKey);

    if (this.bucket) {
      try {
        await this.s3Put(objectKey, encrypted);
        return objectKey;
      } catch (error) {
        this.logger.warn({
          event: 'recruitment.storage.s3_put_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });

        if (this.nodeEnvironment === 'production') {
          throw new ServiceUnavailableException({
            code: 'RECRUITMENT_STORAGE_UNAVAILABLE',
            message: 'Document storage is temporarily unavailable.',
          });
        }
      }
    }

    const absolutePath = join(this.uploadRoot, objectKey);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, encrypted);
    return objectKey;
  }

  async getObject(storageKey: string): Promise<Buffer> {
    this.assertProductionStorageConfigured();

    const objectKey = this.normalizeKey(storageKey);

    if (this.bucket) {
      try {
        return this.crypto.decryptBuffer(await this.s3Get(objectKey));
      } catch (error) {
        this.logger.warn({
          event: 'recruitment.storage.s3_get_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
        if (this.nodeEnvironment === 'production') {
          throw new ServiceUnavailableException({
            code: 'RECRUITMENT_DOCUMENT_NOT_FOUND',
            message: 'Document file is unavailable.',
          });
        }
      }
    }

    const absolutePath = join(this.uploadRoot, objectKey);
    if (!existsSync(absolutePath)) {
      throw new ServiceUnavailableException({
        code: 'RECRUITMENT_DOCUMENT_NOT_FOUND',
        message: 'Document file is unavailable.',
      });
    }

    return this.crypto.decryptBuffer(readFileSync(absolutePath));
  }

  async openObjectStream(storageKey: string): Promise<Readable> {
    const buffer = await this.getObject(storageKey);
    return Readable.from(buffer);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const objectKey = this.normalizeKey(storageKey);

    if (this.bucket) {
      await this.s3Delete(objectKey).catch((error: unknown) => {
        this.logger.warn({
          event: 'recruitment.storage.delete_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      });
      return;
    }

    const absolutePath = join(this.uploadRoot, objectKey);
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
    }
  }

  async quarantineObject(storageKey: string, buffer: Buffer): Promise<string> {
    this.assertProductionStorageConfigured();
    const quarantineKey = this.buildPersistentKey(
      `quarantine/${Date.now()}-${storageKey.replace(/[\\/]/g, '_')}`,
    );
    const encrypted = this.crypto.encryptBuffer(buffer);

    if (this.bucket) {
      try {
        await this.s3Put(quarantineKey, encrypted);
        return quarantineKey;
      } catch (error) {
        this.logger.warn({
          event: 'recruitment.storage.s3_quarantine_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });

        if (this.nodeEnvironment === 'production') {
          throw new ServiceUnavailableException({
            code: 'RECRUITMENT_STORAGE_UNAVAILABLE',
            message: 'Document quarantine storage is temporarily unavailable.',
          });
        }
      }
    }

    const absolutePath = join(this.uploadRoot, quarantineKey);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, encrypted);
    return quarantineKey;
  }

  stageLocal(storageKey: string, buffer: Buffer): string {
    const absolutePath = join(this.uploadRoot, 'staging', storageKey);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, buffer);
    return absolutePath;
  }

  removeLocal(absolutePath: string): void {
    if (existsSync(absolutePath)) {
      unlinkSync(absolutePath);
    }
  }

  localPath(storageKey: string): string {
    return join(this.uploadRoot, this.normalizeKey(storageKey));
  }

  private buildPersistentKey(storageKey: string): string {
    const normalized = this.normalizeKey(storageKey);
    const namespace = `${this.storagePrefix}/recruitment/`;
    return normalized.startsWith(namespace)
      ? normalized
      : `${namespace}${normalized}`;
  }

  private normalizeKey(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
    if (
      !normalized ||
      normalized.split('/').some((segment) => segment === '..')
    ) {
      throw new ServiceUnavailableException({
        code: 'RECRUITMENT_STORAGE_KEY_INVALID',
        message: 'Document storage key is invalid.',
      });
    }
    return normalized;
  }

  private async s3Put(key: string, body: Buffer): Promise<void> {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createS3Client(S3Client);
    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key.replace(/\\/g, '/'),
        Body: body,
        ServerSideEncryption: this.endpoint ? undefined : 'AES256',
      }),
    );
  }

  private async s3Get(key: string): Promise<Buffer> {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3');
    const client = this.createS3Client(S3Client);
    const result = (await client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key.replace(/\\/g, '/'),
      }),
    )) as { Body?: { transformToByteArray: () => Promise<Uint8Array> } };
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new ServiceUnavailableException({
        code: 'RECRUITMENT_DOCUMENT_NOT_FOUND',
        message: 'Document file is unavailable.',
      });
    }
    return Buffer.from(bytes);
  }

  private async s3Delete(key: string): Promise<void> {
    const { S3Client, DeleteObjectCommand } =
      await import('@aws-sdk/client-s3');
    const client = this.createS3Client(S3Client);
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key.replace(/\\/g, '/'),
      }),
    );
  }

  private createS3Client(
    S3Client: new (config: Record<string, unknown>) => {
      send: (command: unknown) => Promise<unknown>;
    },
  ) {
    return new S3Client({
      region: this.region,
      endpoint: this.endpoint,
      forcePathStyle: Boolean(this.endpoint),
      ...(this.accessKey && this.secretKey
        ? {
            credentials: {
              accessKeyId: this.accessKey,
              secretAccessKey: this.secretKey,
            },
          }
        : {}),
    });
  }
}
