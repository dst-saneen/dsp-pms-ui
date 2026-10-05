import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CompanyModuleCode, DeliveryChannel } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { Environment } from '../../config';
import { PrismaService } from '../../prisma/prisma.service';
import { CompanyModuleEntitlementService } from '../module-capabilities/company-module-entitlement.service';

export interface DeliveryClaimResult {
  claimedIds: string[];
  workerId: string;
  workerCorrelationId: string;
}

@Injectable()
export class DeliveryClaimService {
  private readonly logger = new Logger(DeliveryClaimService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<Environment, true>,
    private readonly entitlements: CompanyModuleEntitlementService,
  ) {}

  createWorkerIdentity(role: 'email' | 'inapp'): {
    workerId: string;
    workerCorrelationId: string;
  } {
    const workerCorrelationId = randomUUID();
    const workerId = `delivery-${role}:${hostname()}:${process.pid}:${workerCorrelationId.slice(0, 8)}`;
    return { workerId, workerCorrelationId };
  }

  /**
   * Atomically claim eligible DeliveryMessage rows with FOR UPDATE SKIP LOCKED.
   * Only rows whose active Company has DELIVERY enabled are claimed.
   */
  async claimBatch(input: {
    channel: DeliveryChannel;
    batchSize?: number;
    workerId: string;
  }): Promise<string[]> {
    const companyIds = await this.entitlements.getEnabledCompanyIds(
      CompanyModuleCode.DELIVERY,
    );
    if (companyIds.length === 0) {
      this.logger.warn({
        event: 'delivery.claim.no_enabled_companies',
        message: 'No active Company has Delivery enabled; claiming nothing.',
      });
      return [];
    }

    const batchSize =
      input.batchSize ??
      this.configService.get('DELIVERY_WORKER_BATCH_SIZE', { infer: true });
    const leaseSeconds = this.configService.get(
      'DELIVERY_WORKER_LEASE_SECONDS',
      {
        infer: true,
      },
    );
    const companyScopeSql = this.buildCompanyScopeSql(companyIds);

    const rows = await this.prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `
        WITH candidates AS (
          SELECT m.id
          FROM delivery_messages m
          WHERE m.channel = $1::"DeliveryChannel"
            AND m.status IN (
              'QUEUED'::"DeliveryMessageStatus",
              'RETRY_WAIT'::"DeliveryMessageStatus",
              'BOUNCED_SOFT'::"DeliveryMessageStatus"
            )
            AND m."nextAttemptAt" <= now()
            AND (${companyScopeSql})
          ORDER BY m."nextAttemptAt" ASC, m.id ASC
          LIMIT $2
          FOR UPDATE OF m SKIP LOCKED
        )
        UPDATE delivery_messages m
        SET
          status = 'PROCESSING'::"DeliveryMessageStatus",
          "lockedBy" = $3,
          "lockedAt" = now(),
          "lockExpiresAt" = now() + ($4::text || ' seconds')::interval,
          version = m.version + 1,
          "updatedAt" = now()
        FROM candidates c
        WHERE m.id = c.id
        RETURNING m.id
      `,
      input.channel,
      batchSize,
      input.workerId,
      String(leaseSeconds),
    );

    const claimedIds = rows.map((row) => row.id);
    if (claimedIds.length > 0) {
      this.logger.log({
        event: 'delivery.claim.batch',
        channel: input.channel,
        claimed: claimedIds.length,
        workerId: input.workerId,
      });
    }
    return claimedIds;
  }

  /** Used by workers as a last-line entitlement recheck before sending. */
  async isAllowedScope(
    companyId: string | null | undefined,
    branchId: string | null | undefined,
  ): Promise<boolean> {
    void branchId;
    return this.entitlements.isEnabled(companyId, CompanyModuleCode.DELIVERY);
  }

  private buildCompanyScopeSql(companyIds: readonly string[]): string {
    return `m."companyId" IN (${companyIds
      .map((id) => this.quoteLiteral(id))
      .join(', ')})`;
  }

  private quoteLiteral(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }
}
