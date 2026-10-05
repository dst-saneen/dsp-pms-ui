import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { Environment } from '../../config';
import { DeliveryEmailWorker } from './delivery-email.worker';
import { DeliveryFeatureGateService } from './delivery-feature-gate.service';
import { DeliveryInAppWorker } from './delivery-inapp.worker';
import { DeliveryLeaseRecoveryService } from './delivery-lease-recovery.service';

/**
 * Gate P0.4 — Delivery worker host.
 *
 * Runs only when WORKFORCE_JOBS_ENABLED=true. Company module entitlements are
 * enforced by the claim service, so disabled Companies never enter a batch.
 */
@Injectable()
export class DeliveryJobsScheduler {
  private readonly logger = new Logger(DeliveryJobsScheduler.name);
  private emailRunning = false;
  private inAppRunning = false;
  private recoveryRunning = false;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly emailWorker: DeliveryEmailWorker,
    private readonly inAppWorker: DeliveryInAppWorker,
    private readonly leaseRecovery: DeliveryLeaseRecoveryService,
    private readonly featureGate: DeliveryFeatureGateService,
  ) {}

  private jobsEnabled(): boolean {
    return this.configService.get('WORKFORCE_JOBS_ENABLED', { infer: true });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runEmailWorker() {
    if (!this.jobsEnabled() || this.emailRunning) {
      return;
    }
    this.emailRunning = true;
    const started = Date.now();
    try {
      const batchSize = this.configService.get('DELIVERY_WORKER_BATCH_SIZE', {
        infer: true,
      });
      const result = await this.emailWorker.processBatch(batchSize);
      this.logger.log({
        event: 'delivery.jobs.email',
        durationMs: Date.now() - started,
        ...result,
      });
    } catch (error) {
      this.logger.error({
        event: 'delivery.jobs.email.failed',
        durationMs: Date.now() - started,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
        errorCode: this.errorCode(error),
      });
    } finally {
      this.emailRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runInAppWorker() {
    if (!this.jobsEnabled() || this.inAppRunning) {
      return;
    }
    this.inAppRunning = true;
    const started = Date.now();
    try {
      const batchSize = this.configService.get('DELIVERY_WORKER_BATCH_SIZE', {
        infer: true,
      });
      const result = await this.inAppWorker.processBatch(batchSize);
      this.logger.log({
        event: 'delivery.jobs.inapp',
        durationMs: Date.now() - started,
        ...result,
      });
    } catch (error) {
      this.logger.error({
        event: 'delivery.jobs.inapp.failed',
        durationMs: Date.now() - started,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
        errorCode: this.errorCode(error),
      });
    } finally {
      this.inAppRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runLeaseRecovery() {
    if (!this.jobsEnabled() || this.recoveryRunning) {
      return;
    }
    this.recoveryRunning = true;
    const started = Date.now();
    try {
      const result = await this.leaseRecovery.recoverExpiredLeases();
      if (result.returnedToRetryWait > 0 || result.movedToReconciling > 0) {
        this.logger.warn({
          event: 'delivery.jobs.lease_recovery',
          durationMs: Date.now() - started,
          ...result,
        });
      }
    } catch (error) {
      this.logger.error({
        event: 'delivery.jobs.lease_recovery.failed',
        durationMs: Date.now() - started,
        errorName: error instanceof Error ? error.name : 'UNKNOWN',
        errorCode: this.errorCode(error),
      });
    } finally {
      this.recoveryRunning = false;
    }
  }

  async getHealth() {
    return {
      jobsEnabled: this.jobsEnabled(),
      workforceJobsEnabled: this.configService.get('WORKFORCE_JOBS_ENABLED', {
        infer: true,
      }),
      deliveryEnabledForAnyCompany:
        await this.featureGate.hasAnyEnabledCompany(),
      running: {
        email: this.emailRunning,
        inApp: this.inAppRunning,
        recovery: this.recoveryRunning,
      },
    };
  }

  private errorCode(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code;
    }

    return error instanceof Error ? error.name : 'UNKNOWN';
  }
}
