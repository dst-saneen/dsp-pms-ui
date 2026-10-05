/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */

import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import {
  requestContextMiddleware,
  ResponseInterceptor,
} from '../../src/common';
import { HealthController, HealthService } from '../../src/modules/health';
import { RedisService } from '../../src/modules/auth/redis.service';
import { S3StorageAdapter } from '../../src/modules/file-storage/adapters/s3-storage.adapter';
import { ClamAvScannerWorker } from '../../src/modules/file-storage/workers/clamav-scanner.worker';
import { TransactionalMailService } from '../../src/modules/mail/transactional-mail.service';
import { CompanyModuleEntitlementService } from '../../src/modules/module-capabilities/company-module-entitlement.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createPrismaMock } from '../utils/prisma.mock';

describe('health endpoints', () => {
  let app: INestApplication;
  const prisma = createPrismaMock();
  const redis = {
    checkHealth: jest.fn<Promise<boolean>, []>(),
  };
  const storage = {
    checkReadiness: jest.fn().mockResolvedValue({
      healthy: true,
      privateAccess: true,
      encryptionEnabled: true,
    }),
  };
  const scanner = {
    checkReadiness: jest.fn().mockResolvedValue({ healthy: true }),
  };
  const entitlements = {
    hasAnyEnabled: jest.fn().mockResolvedValue(false),
  };
  const mail = {
    getDeliveryProviderReadiness: jest.fn().mockReturnValue({
      provider: 'SMTP',
      externalProviderReady: true,
      developmentBypass: false,
    }),
  };

  beforeAll(async () => {
    const moduleReference = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: RedisService,
          useValue: redis,
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'DATABASE_HEALTH_TIMEOUT_MS') {
                return 3_000;
              }

              throw new Error(`Unexpected configuration key: ${key}`);
            },
            get: (key: string) => {
              if (key === 'REDIS_ENABLED') return true;
              if (key === 'FILE_SCAN_WORKER_ENABLED') {
                return false;
              }
              return undefined;
            },
          },
        },
        {
          provide: S3StorageAdapter,
          useValue: storage,
        },
        {
          provide: ClamAvScannerWorker,
          useValue: scanner,
        },
        {
          provide: CompanyModuleEntitlementService,
          useValue: entitlements,
        },
        {
          provide: TransactionalMailService,
          useValue: mail,
        },
      ],
    }).compile();

    app = moduleReference.createNestApplication({
      logger: false,
    });
    app.use(requestContextMiddleware);
    app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    redis.checkHealth.mockResolvedValue(true);
    entitlements.hasAnyEnabled.mockResolvedValue(false);
    mail.getDeliveryProviderReadiness.mockReturnValue({
      provider: 'SMTP',
      externalProviderReady: true,
      developmentBypass: false,
    });
  });

  it('reports the selected email provider instead of ZeptoMail-only readiness', async () => {
    entitlements.hasAnyEnabled.mockResolvedValue(true);

    await expect(
      app.get(HealthService).getDeliveryMode(),
    ).resolves.toMatchObject({
      deliveryEnabledForAnyCompany: true,
      entitlementSource: 'DATABASE',
      email: {
        provider: 'SMTP',
        externalProviderReady: true,
        developmentBypass: false,
      },
      security: {
        contentEncryption: false,
        addressHmac: false,
        commandReceiptHmac: false,
      },
    });
  });

  it('fails readiness when required Redis is unavailable', async () => {
    prisma.checkHealth.mockResolvedValue(undefined);
    redis.checkHealth.mockResolvedValue(false);

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      checks: {
        database: 'up',
        redis: 'down',
      },
    });
  });

  it('returns direct liveness output without the business envelope', async () => {
    const response = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.success).toBeUndefined();
    expect(response.body.uptimeSeconds).toEqual(expect.any(Number));
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('returns ready when the database responds', async () => {
    prisma.checkHealth.mockResolvedValue(undefined);

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);

    expect(prisma.checkHealth).toHaveBeenCalledWith(3_000);
    expect(response.body).toMatchObject({
      status: 'ok',
      checks: {
        database: 'up',
      },
    });
  });

  it('returns 503 without database error details when unavailable', async () => {
    prisma.checkHealth.mockRejectedValue(
      new Error('database-host-and-password-must-not-leak'),
    );

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      checks: {
        database: 'down',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'database-host-and-password-must-not-leak',
    );
  });

  it('does not misreport a dependency failure as a database outage', async () => {
    prisma.checkHealth.mockResolvedValue(undefined);
    entitlements.hasAnyEnabled.mockRejectedValue(
      new Error('entitlement-query-details-must-not-leak'),
    );

    const response = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);

    expect(response.body).toMatchObject({
      status: 'error',
      checks: {
        database: 'up',
        dependencies: 'down',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      'entitlement-query-details-must-not-leak',
    );
  });
});
