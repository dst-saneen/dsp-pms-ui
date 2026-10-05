import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import {
  FileRetentionClass,
  FileUploadPurpose,
  CompanyModuleCode,
  PayrollActionEntityType,
  PayrollPayslipStatus,
  PayrollRunStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { withSerializationRetry } from '../../../common';
import { erpOpsMetrics } from '../../../common/observability/erp-ops-metrics';
import { PrismaService } from '../../../prisma/prisma.service';
import { GeneratedFileService } from '../../file-storage/services/generated-file.service';
import { OutboxWriterService } from '../../outbox/outbox-writer.service';

import { PayrollPayslipsService } from './payroll-payslips.service';
import { PayrollScopeService } from './payroll-scope.service';
import { PayrollFeatureService } from './payroll-feature.service';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';

const LEASE_TTL_MS = 5 * 60 * 1000;
const MAX_GENERATION_ATTEMPTS = 5;
const FAILURE_DEAD_LETTER = 'DEAD_LETTER';

/** A terminal outbox skip; no retry or generated artifact is appropriate. */
export const PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED =
  'SKIPPED_MODULE_DISABLED';
export type PayrollPayslipGenerationOutcome =
  'COMPLETED' | typeof PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED;

export class PayslipLeaseHeldError extends Error {
  readonly code = 'PAYSLIP_LEASE_HELD';

  constructor(payslipId: string) {
    super(`Payslip generation lease is held by another worker: ${payslipId}`);
    this.name = 'PayslipLeaseHeldError';
  }
}

@Injectable()
export class PayrollPayslipWorkerService {
  private readonly logger = new Logger(PayrollPayslipWorkerService.name);

  constructor(
    @Inject(forwardRef(() => PrismaService))
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => PayrollPayslipsService))
    private readonly payslips: PayrollPayslipsService,
    @Inject(forwardRef(() => GeneratedFileService))
    private readonly generatedFiles: GeneratedFileService,
    @Inject(forwardRef(() => OutboxWriterService))
    private readonly outbox: OutboxWriterService,
    @Inject(forwardRef(() => PayrollScopeService))
    private readonly scope: PayrollScopeService,
    private readonly feature: PayrollFeatureService,
  ) {}

  async processGenerateEvent(input: {
    payslipId: string;
    companyId: string;
  }): Promise<PayrollPayslipGenerationOutcome> {
    // A queued event must not bypass a module disable that happened after the
    // run was paid. This occurs before loading/generating the PDF and records
    // a visible, retryable terminal state for payroll operations.
    if (!(await this.feature.isEnabledForCompany(input.companyId))) {
      await this.cancelForDisabledModule(input);
      return PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED;
    }

    const payslip = await this.prisma.payrollPayslip.findFirst({
      where: { id: input.payslipId, companyId: input.companyId },
      include: {
        payrollRun: true,
        employee: { select: { branchId: true } },
      },
    });

    if (!payslip) {
      this.logger.warn(`Payslip not found id=${input.payslipId}`);
      return 'COMPLETED';
    }

    if (
      payslip.status === PayrollPayslipStatus.AVAILABLE &&
      payslip.fileObjectId
    ) {
      return 'COMPLETED';
    }

    if (
      payslip.failureCode === FAILURE_DEAD_LETTER ||
      payslip.generationAttemptCount >= MAX_GENERATION_ATTEMPTS
    ) {
      this.logger.warn(
        `Payslip dead-lettered id=${payslip.id} attempts=${payslip.generationAttemptCount}`,
      );
      return 'COMPLETED';
    }

    if (payslip.payrollRun.statusEnum !== PayrollRunStatus.PAID) {
      throw new Error('PAYSLIP_RUN_NOT_PAID');
    }

    const leaseId = randomUUID();
    const leaseExpiresAt = new Date(Date.now() + LEASE_TTL_MS);
    const now = new Date();

    const claimed = await this.prisma.payrollPayslip.updateMany({
      where: {
        id: payslip.id,
        companyId: payslip.companyId,
        fileObjectId: null,
        OR: [
          {
            status: {
              in: [PayrollPayslipStatus.PENDING, PayrollPayslipStatus.FAILED],
            },
          },
          {
            status: PayrollPayslipStatus.GENERATING,
            OR: [
              { generationLeaseExpiresAt: null },
              { generationLeaseExpiresAt: { lt: now } },
            ],
          },
        ],
      },
      data: {
        status: PayrollPayslipStatus.GENERATING,
        generationLeaseId: leaseId,
        generationLeaseExpiresAt: leaseExpiresAt,
        generationAttemptCount: { increment: 1 },
        lastAttemptAt: now,
        failureCode: null,
        version: { increment: 1 },
      },
    });

    if (claimed.count !== 1) {
      const latest = await this.prisma.payrollPayslip.findUnique({
        where: { id: payslip.id },
      });
      if (
        latest?.status === PayrollPayslipStatus.AVAILABLE &&
        latest.fileObjectId
      ) {
        return 'COMPLETED';
      }
      if (
        latest?.status === PayrollPayslipStatus.GENERATING &&
        latest.generationLeaseExpiresAt &&
        latest.generationLeaseExpiresAt > now
      ) {
        throw new PayslipLeaseHeldError(payslip.id);
      }
      throw new PayslipLeaseHeldError(payslip.id);
    }

    let generatedArtifact:
      | {
          intentId: string;
          objectKey: string;
          fileObjectId: string;
        }
      | undefined;
    try {
      const pdf = await this.payslips.generatePayslipPdf(payslip.id);
      const fileName = `payslip-${payslip.employeeCode}-${payslip.payrollYear}-${String(payslip.payrollMonth).padStart(2, '0')}.pdf`;
      const actorUserId =
        payslip.payrollRun.paidByUserId ?? payslip.payrollRun.createdByUserId;

      const outcome = await withSerializationRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const current = await tx.payrollPayslip.findFirst({
              where: {
                id: payslip.id,
                companyId: payslip.companyId,
                generationLeaseId: leaseId,
                status: PayrollPayslipStatus.GENERATING,
              },
            });
            if (!current) {
              throw new PayslipLeaseHeldError(payslip.id);
            }
            if (
              current.fileObjectId ||
              current.status === PayrollPayslipStatus.AVAILABLE
            ) {
              return 'COMPLETED' as const;
            }

            // The initial feature check prevents normal disabled work. This
            // serializable in-transaction check closes the disable-after-claim
            // race before any object/file or follow-on outbox event is created.
            const entitlement = await tx.companyModuleEntitlement.findFirst({
              where: {
                companyId: payslip.companyId,
                module: CompanyModuleCode.PAYROLL,
                isEnabled: true,
                company: { isActive: true },
              },
              select: { id: true },
            });
            if (!entitlement) {
              await tx.payrollPayslip.updateMany({
                where: {
                  id: payslip.id,
                  companyId: payslip.companyId,
                  generationLeaseId: leaseId,
                  status: PayrollPayslipStatus.GENERATING,
                  fileObjectId: null,
                },
                data: {
                  status: PayrollPayslipStatus.FAILED,
                  failureCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
                  generationLeaseId: null,
                  generationLeaseExpiresAt: null,
                  version: { increment: 1 },
                },
              });
              return PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED;
            }

            const fileObject =
              await this.generatedFiles.storeCleanGeneratedFile({
                companyId: payslip.companyId,
                branchId: payslip.employee.branchId,
                fileName,
                mimeType: 'application/pdf',
                content: pdf,
                retentionClass: FileRetentionClass.PAYROLL_PAYSLIP,
                purpose: FileUploadPurpose.PAYROLL_PAYSLIP,
                creatorUserId: actorUserId,
                correlationId: payslip.id,
                tx,
              });
            generatedArtifact = {
              intentId: fileObject.generatedFileIntentId,
              objectKey: fileObject.generatedObjectKey,
              fileObjectId: fileObject.id,
            };

            const finalized = await tx.payrollPayslip.updateMany({
              where: {
                id: payslip.id,
                companyId: payslip.companyId,
                generationLeaseId: leaseId,
                status: PayrollPayslipStatus.GENERATING,
                fileObjectId: null,
              },
              data: {
                status: PayrollPayslipStatus.AVAILABLE,
                fileObjectId: fileObject.id,
                generatedAt: new Date(),
                failureCode: null,
                generationLeaseId: null,
                generationLeaseExpiresAt: null,
                version: { increment: 1 },
              },
            });

            if (finalized.count !== 1) {
              throw new PayslipLeaseHeldError(payslip.id);
            }

            const updated = await tx.payrollPayslip.findUniqueOrThrow({
              where: { id: payslip.id },
            });

            if (actorUserId) {
              await this.scope.recordActionEvent(tx, {
                companyId: payslip.companyId,
                entityType: PayrollActionEntityType.PAYSLIP,
                entityId: payslip.id,
                action: 'AVAILABLE',
                actorUserId,
                operationId: `payslip-generate:${payslip.id}:${leaseId}`,
                versionBefore: current.version,
                versionAfter: updated.version,
              });
            }

            await this.outbox.write(tx, {
              aggregateType: 'PayrollPayslip',
              aggregateId: payslip.id,
              eventType: 'payroll.payslip.available',
              payload: {
                companyId: payslip.companyId,
                employeeId: payslip.employeeId,
                payslipId: payslip.id,
              },
              dedupeKey: `payroll-payslip-available:${payslip.id}`,
              companyId: payslip.companyId,
              branchId: payslip.employee.branchId,
            });
            return 'COMPLETED' as const;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        ),
      );

      if (outcome === PAYSLIP_GENERATION_SKIPPED_MODULE_DISABLED) {
        this.logger.warn(
          `Payslip generation cancelled because Payroll is disabled id=${payslip.id}`,
        );
      }
      return outcome;
    } catch (error) {
      if (generatedArtifact) {
        await this.generatedFiles.compensateAfterTransactionFailure(
          generatedArtifact,
        );
      }
      if (error instanceof PayslipLeaseHeldError) {
        throw error;
      }

      const attemptCount = payslip.generationAttemptCount + 1;
      const deadLetter = attemptCount >= MAX_GENERATION_ATTEMPTS;
      const code = deadLetter
        ? FAILURE_DEAD_LETTER
        : error instanceof Error && 'code' in error
          ? String(
              (error as { code?: string }).code ?? 'PAYSLIP_GENERATION_FAILED',
            ).slice(0, 64)
          : 'PAYSLIP_GENERATION_FAILED';

      await this.prisma.payrollPayslip.updateMany({
        where: {
          id: payslip.id,
          companyId: payslip.companyId,
          generationLeaseId: leaseId,
          status: PayrollPayslipStatus.GENERATING,
        },
        data: {
          status: PayrollPayslipStatus.FAILED,
          failureCode: code,
          generationLeaseId: null,
          generationLeaseExpiresAt: null,
          version: { increment: 1 },
        },
      });

      if (deadLetter) {
        erpOpsMetrics.record('payslip_dead_letter', 'payroll', {
          payslipId: payslip.id,
        });
      }

      this.logger.error(
        `Payslip generation failed id=${payslip.id} code=${code}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (deadLetter) {
        return 'COMPLETED';
      }
      throw error;
    }
  }

  private async cancelForDisabledModule(input: {
    payslipId: string;
    companyId: string;
  }): Promise<void> {
    const cancelled = await this.prisma.payrollPayslip.updateMany({
      where: {
        id: input.payslipId,
        companyId: input.companyId,
        fileObjectId: null,
        status: {
          in: [PayrollPayslipStatus.PENDING, PayrollPayslipStatus.FAILED],
        },
      },
      data: {
        status: PayrollPayslipStatus.FAILED,
        failureCode: PAYROLL_ERROR_CODES.PAYROLL_MODULE_NOT_ENABLED,
        generationLeaseId: null,
        generationLeaseExpiresAt: null,
        version: { increment: 1 },
      },
    });

    if (cancelled.count > 0) {
      this.logger.warn(
        `Payslip generation cancelled because Payroll is disabled id=${input.payslipId}`,
      );
    }
  }
}
