import { S3Client } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../config';
import { resolveS3Endpoint } from '../recruitment/document/s3-endpoint';

export interface StorageS3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
}

export class StorageS3NotConfiguredError extends Error {
  constructor(
    message = 'File storage S3 is not configured. Set STORAGE_S3_BUCKET.',
  ) {
    super(message);
    this.name = 'StorageS3NotConfiguredError';
  }
}

export function resolveConfiguredS3Endpoint(
  storageEndpoint?: string | null,
): string | undefined {
  return resolveS3Endpoint(storageEndpoint);
}

export function resolveStorageS3Config(
  config: ConfigService<Environment, true>,
  options: { required?: boolean } = {},
): StorageS3Config | null {
  const bucket = config.get('STORAGE_S3_BUCKET', { infer: true });

  if (!bucket) {
    if (
      options.required ??
      config.getOrThrow('NODE_ENV', { infer: true }) === 'production'
    ) {
      throw new StorageS3NotConfiguredError();
    }
    return null;
  }

  const region = config.get('STORAGE_S3_REGION', { infer: true });
  if (!region) {
    throw new StorageS3NotConfiguredError(
      'File storage S3 is not configured. Set STORAGE_S3_REGION.',
    );
  }

  return {
    bucket,
    region,
    endpoint: resolveConfiguredS3Endpoint(
      config.get('STORAGE_S3_ENDPOINT', { infer: true }),
    ),
    accessKeyId:
      config.get('STORAGE_S3_ACCESS_KEY_ID', { infer: true }) ?? undefined,
    secretAccessKey:
      config.get('STORAGE_S3_SECRET_ACCESS_KEY', { infer: true }) ?? undefined,
  };
}

export function createStorageS3Client(config: StorageS3Config): S3Client {
  return new S3Client({
    region: config.region,
    ...(config.endpoint
      ? { endpoint: config.endpoint, forcePathStyle: true }
      : {}),
    ...(config.accessKeyId && config.secretAccessKey
      ? {
          credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
          },
        }
      : {}),
  });
}
