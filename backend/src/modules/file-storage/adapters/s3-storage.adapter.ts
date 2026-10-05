import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import { Readable } from 'stream';

import type { Environment } from '../../../config';
import {
  createStorageS3Client,
  resolveStorageS3Config,
  StorageS3NotConfiguredError,
} from '../storage-s3.config';
import { hexSha256ToS3Checksum, s3ChecksumToHex } from '../file-storage.crypto';

export interface PresignedPutResult {
  url: string;
  headers: Record<string, string>;
  objectKey: string;
  expiresAt: Date;
}

export interface PresignedGetResult {
  url: string;
  expiresAt: Date;
}

export interface ObjectMetadata {
  sizeBytes: number;
  checksumSha256: string | null;
  contentType: string | null;
  sseMode: string | null;
  sseKeyRef: string | null;
}

export interface StorageReadinessResult {
  healthy: boolean;
  privateAccess: boolean;
  encryptionEnabled: boolean;
  errorMessage?: string;
}

@Injectable()
export class S3StorageAdapter implements OnModuleInit {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private client?: S3Client;
  private bucket?: string;
  private configured = false;
  private storagePrefix = 'development';
  private presignedPutTtlSeconds = 900;
  private presignedGetTtlSeconds = 300;

  constructor(private readonly config: ConfigService<Environment, true>) {}

  onModuleInit() {
    const storage = resolveStorageS3Config(this.config);
    this.storagePrefix = this.config.getOrThrow('STORAGE_S3_PREFIX', {
      infer: true,
    });
    this.presignedPutTtlSeconds = this.config.get(
      'STORAGE_PRESIGNED_PUT_TTL_SECONDS',
      { infer: true },
    );
    this.presignedGetTtlSeconds = this.config.get(
      'STORAGE_PRESIGNED_GET_TTL_SECONDS',
      { infer: true },
    );

    if (!storage) {
      this.logger.warn(
        'File storage S3 is not configured; signed-offer and secure upload APIs will be unavailable until STORAGE_S3_BUCKET is set.',
      );
      return;
    }

    this.bucket = storage.bucket;
    this.client = createStorageS3Client(storage);
    this.configured = true;
  }

  private requireStorage(): { client: S3Client; bucket: string } {
    if (!this.configured || !this.client || !this.bucket) {
      throw new StorageS3NotConfiguredError();
    }

    return { client: this.client, bucket: this.bucket };
  }

  generateQuarantineKey(companyId: string, branchId: string | null): string {
    this.requireStorage();
    const scope = branchId ?? companyId;
    const uuid = crypto.randomUUID();
    return `${this.storagePrefix}/${companyId}/${scope}/quarantine/${uuid}`;
  }

  generateCleanKey(
    companyId: string,
    branchId: string | null,
    existingUuid: string,
  ): string {
    this.requireStorage();
    const scope = branchId ?? companyId;
    return `${this.storagePrefix}/${companyId}/${scope}/clean/${existingUuid}`;
  }

  private extractUuidFromKey(quarantineKey: string): string {
    return quarantineKey.split('/').pop()!;
  }

  async createPresignedPut(
    objectKey: string,
    declaredMimeType: string,
    _expectedSizeBytes: number,
    expectedChecksumSha256: string,
  ): Promise<PresignedPutResult> {
    const { client, bucket } = this.requireStorage();
    const checksum = hexSha256ToS3Checksum(expectedChecksumSha256);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: declaredMimeType,
      ChecksumSHA256: checksum,
      ServerSideEncryption: 'AES256',
    });

    // Checksum / SSE must stay as signed request headers (not query params).
    // Otherwise browser PUT fails with HeadersNotSigned: x-amz-checksum-sha256.
    const url = await getSignedUrl(client, command, {
      expiresIn: this.presignedPutTtlSeconds,
      unhoistableHeaders: new Set([
        'x-amz-checksum-sha256',
        'x-amz-server-side-encryption',
      ]),
    });

    const expiresAt = new Date(Date.now() + this.presignedPutTtlSeconds * 1000);

    return {
      url,
      headers: {
        'Content-Type': declaredMimeType,
        'x-amz-checksum-sha256': checksum,
        'x-amz-server-side-encryption': 'AES256',
      },
      objectKey,
      expiresAt,
    };
  }

  async putObjectBytes(input: {
    objectKey: string;
    body: Buffer;
    contentType: string;
    checksumSha256: string;
  }): Promise<void> {
    const { client, bucket } = this.requireStorage();
    const checksum = hexSha256ToS3Checksum(input.checksumSha256);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
        ChecksumSHA256: checksum,
        ServerSideEncryption: 'AES256',
      }),
    );
  }

  async createPresignedGet(
    objectKey: string,
    downloadFilename: string,
  ): Promise<PresignedGetResult> {
    const { client, bucket } = this.requireStorage();
    const encodedName = encodeURIComponent(downloadFilename);
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ResponseContentDisposition: `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
    });

    const url = await getSignedUrl(client, command, {
      expiresIn: this.presignedGetTtlSeconds,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + this.presignedGetTtlSeconds * 1000),
    };
  }

  async headObject(objectKey: string): Promise<ObjectMetadata | null> {
    const { client, bucket } = this.requireStorage();
    try {
      const result = await client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: objectKey }),
      );

      const rawChecksum = result.ChecksumSHA256 ?? null;

      return {
        sizeBytes: result.ContentLength ?? 0,
        checksumSha256: s3ChecksumToHex(rawChecksum),
        contentType: result.ContentType ?? null,
        sseMode: result.ServerSideEncryption ?? null,
        sseKeyRef: result.SSEKMSKeyId ?? null,
      };
    } catch (err) {
      if (
        err instanceof S3ServiceException &&
        err.$metadata.httpStatusCode === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async copyToClean(
    quarantineKey: string,
    companyId: string,
    branchId: string | null,
  ): Promise<string> {
    const { client, bucket } = this.requireStorage();
    const uuid = this.extractUuidFromKey(quarantineKey);
    const cleanKey = this.generateCleanKey(companyId, branchId, uuid);

    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${quarantineKey}`,
        Key: cleanKey,
        ServerSideEncryption: 'AES256',
        MetadataDirective: 'COPY',
      }),
    );

    return cleanKey;
  }

  isQuarantineKey(objectKey: string): boolean {
    return objectKey.includes('/quarantine/');
  }

  isCleanKey(objectKey: string): boolean {
    return objectKey.includes('/clean/');
  }

  async getObjectStream(objectKey: string): Promise<Readable> {
    const { client, bucket } = this.requireStorage();
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
    return response.Body as Readable;
  }

  async deleteObject(objectKey: string): Promise<void> {
    const { client, bucket } = this.requireStorage();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }),
    );
  }

  async checkReadiness(): Promise<StorageReadinessResult> {
    if (!this.configured) {
      return {
        healthy: false,
        privateAccess: false,
        encryptionEnabled: false,
        errorMessage: new StorageS3NotConfiguredError().message,
      };
    }

    const { client, bucket } = this.requireStorage();
    try {
      const testKey = `${this.storagePrefix}/readiness-probe/${crypto.randomUUID()}`;
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: testKey,
          Body: Buffer.from('probe'),
          ServerSideEncryption: 'AES256',
        }),
      );

      const head = await this.headObject(testKey);
      await this.deleteObject(testKey);

      const encryptionEnabled = head?.sseMode != null;

      return {
        healthy: true,
        privateAccess: true,
        encryptionEnabled,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Storage readiness check failed', message);
      return {
        healthy: false,
        privateAccess: false,
        encryptionEnabled: false,
        errorMessage: message,
      };
    }
  }
}
