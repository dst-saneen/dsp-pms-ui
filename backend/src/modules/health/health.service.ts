import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../auth/redis.service';
import { S3StorageAdapter } from '../file-storage/adapters/s3-storage.adapter';
import { ClamAvScannerWorker } from '../file-storage/workers/clamav-scanner.worker';
import { TransactionalMailService } from '../mail/transactional-mail.service';
import { CompanyModuleEntitlementService } from '../module-capabilities/company-module-entitlement.service';
import { CompanyModuleCode } from '@prisma/client';

@Injectable()
export class HealthService implements OnApplicationShutdown {
  private readonly logger = new Logger(HealthService.name);
  private acceptingTraffic = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly storage: S3StorageAdapter,
    private readonly scanner: ClamAvScannerWorker,
    private readonly entitlements: CompanyModuleEntitlementService,
    private readonly mail: TransactionalMailService,
  ) {}

  onApplicationShutdown(): void {
    this.acceptingTraffic = false;
  }

  async getDeliveryMode(): Promise<{
    deliveryEnabledForAnyCompany: boolean;
    entitlementSource: 'DATABASE';
    email: {
      provider: 'SMTP';
      externalProviderReady: boolean;
      developmentBypass: boolean;
    };
    security: {
      contentEncryption: boolean;
      addressHmac: boolean;
      commandReceiptHmac: boolean;
    };
    worker: {
      leaseSeconds: number;
      batchSize: number;
    };
  }> {
    const contentKeys = this.configService.get(
      'DELIVERY_CONTENT_ENCRYPTION_KEYS',
      { infer: true },
    );
    const contentVersion = this.configService.get(
      'DELIVERY_CONTENT_ENCRYPTION_ACTIVE_VERSION',
      { infer: true },
    );
    const addressKeys = this.configService.get('DELIVERY_ADDRESS_HMAC_KEYS', {
      infer: true,
    });
    const addressVersion = this.configService.get(
      'DELIVERY_ADDRESS_HMAC_ACTIVE_VERSION',
      { infer: true },
    );
    const receiptKeys = this.configService.get(
      'DELIVERY_COMMAND_RECEIPT_HMAC_KEYS',
      { infer: true },
    );
    const receiptVersion = this.configService.get(
      'DELIVERY_COMMAND_RECEIPT_HMAC_ACTIVE_VERSION',
      { infer: true },
    );
    const emailReadiness = this.mail.getDeliveryProviderReadiness();

    return {
      deliveryEnabledForAnyCompany: await this.entitlements.hasAnyEnabled(
        CompanyModuleCode.DELIVERY,
      ),
      entitlementSource: 'DATABASE',
      email: {
        provider: emailReadiness.provider,
        externalProviderReady: emailReadiness.externalProviderReady,
        developmentBypass: emailReadiness.developmentBypass,
      },
      security: {
        contentEncryption: Boolean(contentKeys?.[contentVersion]),
        addressHmac: Boolean(addressKeys?.[addressVersion]),
        commandReceiptHmac: Boolean(receiptKeys?.[receiptVersion]),
      },
      worker: {
        leaseSeconds: this.configService.get('DELIVERY_WORKER_LEASE_SECONDS', {
          infer: true,
        }),
        batchSize: this.configService.get('DELIVERY_WORKER_BATCH_SIZE', {
          infer: true,
        }),
      },
    };
  }

  getLiveness() {
    return {
      status: 'ok' as const,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  async getReadiness() {
    if (!this.acceptingTraffic) {
      return {
        status: 'error' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'down' as const,
        },
      };
    }

    try {
      await this.prisma.checkHealth(
        this.configService.getOrThrow('DATABASE_HEALTH_TIMEOUT_MS', {
          infer: true,
        }),
      );
    } catch (error) {
      this.logger.warn({
        event: 'health.database.unavailable',
        ...this.safeErrorDiagnostic(error),
      });

      return {
        status: 'error' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'down' as const,
        },
      };
    }

    try {
      const redisEnabled = this.configService.get('REDIS_ENABLED', {
        infer: true,
      });
      const redisReady = redisEnabled ? await this.redis.checkHealth() : true;
      const fileStorageEnabled = await this.entitlements.hasAnyEnabled(
        CompanyModuleCode.FILE_STORAGE,
      );
      const scanWorkerEnabled = this.configService.get(
        'FILE_SCAN_WORKER_ENABLED',
        { infer: true },
      );

      const [storage, clamav] = await Promise.all([
        fileStorageEnabled
          ? this.storage.checkReadiness()
          : Promise.resolve({
              healthy: true,
              privateAccess: true,
              encryptionEnabled: true,
            }),
        scanWorkerEnabled
          ? this.scanner.checkReadiness()
          : Promise.resolve({ healthy: true }),
      ]);

      const storageStatus = storage.healthy
        ? ('up' as const)
        : ('down' as const);
      const clamavStatus = clamav.healthy ? ('up' as const) : ('down' as const);
      const requiredChecksOk =
        (!redisEnabled || redisReady) &&
        (!fileStorageEnabled || storage.healthy) &&
        (!scanWorkerEnabled || clamav.healthy);

      let status: 'ok' | 'degraded' | 'error' = 'error';
      if (requiredChecksOk) {
        status =
          redisReady && storage.healthy && clamav.healthy ? 'ok' : 'degraded';
      }

      return {
        status,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'up' as const,
          redis: !redisEnabled
            ? ('skipped' as const)
            : redisReady
              ? ('up' as const)
              : ('down' as const),
          objectStorage: fileStorageEnabled
            ? storageStatus
            : ('skipped' as const),
          clamav: scanWorkerEnabled ? clamavStatus : ('skipped' as const),
        },
      };
    } catch (error) {
      this.logger.warn({
        event: 'health.dependency.unavailable',
        ...this.safeErrorDiagnostic(error),
      });

      return {
        status: 'error' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'up' as const,
          dependencies: 'down' as const,
        },
      };
    }
  }

  /**
   * Keep public health output free of provider, host, query, and credential
   * details while retaining a safe operational correlation code in logs.
   */
  private safeErrorDiagnostic(error: unknown): {
    errorName: string;
    errorCode?: string;
  } {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const candidate =
      error && typeof error === 'object' && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    const errorCode =
      typeof candidate === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(candidate)
        ? candidate
        : undefined;

    return {
      errorName,
      ...(errorCode ? { errorCode } : {}),
    };
  }
}
