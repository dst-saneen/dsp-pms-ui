import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import {
  FileObjectStatus,
  FileRetentionClass,
  FileOperationType,
  FileOperationStatus,
} from '@prisma/client';
import { FileStorageFeatureService } from './file-storage-feature.service';

@Injectable()
export class FileRetentionService {
  private readonly logger = new Logger(FileRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly features: FileStorageFeatureService,
  ) {}

  async runExpiredSessionCleanup(): Promise<void> {
    const expired = await this.prisma.fileUploadSession.findMany({
      where: {
        status: { in: ['ISSUED', 'UPLOADED', 'FINALIZING'] },
        expiresAt: { lt: new Date() },
      },
      take: 100,
    });

    for (const session of expired) {
      try {
        await this.prisma.fileUploadSession.update({
          where: { id: session.id },
          data: { status: 'EXPIRED' },
        });

        if (session.fileObjectId) {
          await this.prisma.fileObject.update({
            where: { id: session.fileObjectId },
            data: { status: FileObjectStatus.UNREFERENCED },
          });
        } else {
          try {
            await this.storage.deleteObject(session.quarantineObjectKey);
          } catch {
            // best effort; orphan scanner will catch remaining
          }
        }
      } catch (err) {
        this.logger.warn(
          `Session cleanup failed for ${session.id}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(`Cleaned up ${expired.length} expired upload sessions.`);
  }

  async runUnreferencedObjectPurge(companyId: string): Promise<void> {
    if (!this.features.retentionPurgeEnabled()) {
      return;
    }
    const policy = await this.prisma.fileRetentionPolicy.findFirst({
      where: {
        companyId,
        retentionClass: FileRetentionClass.PUBLIC_UPLOAD_ORPHAN,
        enabled: true,
        approvedAt: { not: null },
      },
    });

    if (!policy) {
      this.logger.log(
        `No approved purge policy for ${companyId} - PUBLIC_UPLOAD_ORPHAN. Skipping.`,
      );
      return;
    }

    const cutoff = new Date(
      Date.now() - policy.retentionValue * 60 * 60 * 1000,
    );

    const objects = await this.prisma.fileObject.findMany({
      where: {
        companyId,
        status: FileObjectStatus.UNREFERENCED,
        updatedAt: { lt: cutoff },
        legalHoldAt: null,
        deletionCompletedAt: null,
      },
      take: 50,
    });

    for (const obj of objects) {
      await this.scheduleDelete(obj.id, obj.objectKey);
    }

    this.logger.log(
      `Scheduled ${objects.length} unreferenced objects for deletion.`,
    );
  }

  private async scheduleDelete(
    fileObjectId: string,
    objectKey: string,
  ): Promise<void> {
    const existing = await this.prisma.fileOperationAttempt.findFirst({
      where: {
        fileObjectId,
        operationType: FileOperationType.DELETE,
        status: { in: ['PENDING', 'PROCESSING', 'RETRY_WAIT'] },
      },
    });
    if (existing) return;

    const refs = await this.prisma.$transaction(async (tx) => {
      const obj = await tx.fileObject.findUnique({
        where: { id: fileObjectId },
      });
      if (!obj || obj.legalHoldAt) {
        return { blocked: true as const };
      }
      const [recruitment, employee, signatures] = await Promise.all([
        tx.recruitmentDocument.count({ where: { fileObjectId } }),
        tx.employeeDocument.count({ where: { fileObjectId } }),
        tx.offerSignatureSubmission.count({ where: { fileObjectId } }),
      ]);
      if (recruitment + employee + signatures > 0) {
        return { blocked: true as const };
      }
      await tx.fileObject.update({
        where: { id: fileObjectId },
        data: { status: FileObjectStatus.DELETION_PENDING },
      });
      await tx.fileOperationAttempt.create({
        data: {
          fileObjectId,
          operationType: FileOperationType.DELETE,
          attemptNo: 1,
          status: FileOperationStatus.PENDING,
        },
      });
      return { blocked: false as const };
    });

    if (refs.blocked) {
      return;
    }

    try {
      await this.storage.deleteObject(objectKey);
      await this.prisma.fileObject.update({
        where: { id: fileObjectId },
        data: {
          status: FileObjectStatus.DELETED,
          deletionCompletedAt: new Date(),
        },
      });
      await this.prisma.fileOperationAttempt.updateMany({
        where: { fileObjectId, operationType: FileOperationType.DELETE },
        data: {
          status: FileOperationStatus.SUCCEEDED,
          completedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to delete object ${objectKey}: ${(err as Error).message}`,
      );
      await this.prisma.fileOperationAttempt.updateMany({
        where: {
          fileObjectId,
          operationType: FileOperationType.DELETE,
          status: FileOperationStatus.PENDING,
        },
        data: {
          status: FileOperationStatus.DEAD_LETTER,
          safeErrorCode: 'STORAGE_DELETE_FAILED',
          nextAttemptAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  async getOperationsStats(companyId: string) {
    await this.features.assertStorageWritesAllowed(companyId, null);
    const [
      scanFailures,
      infectedCount,
      expiredSessions,
      unreferencedObjects,
      missingObjects,
      deletionDeadLetters,
      retryableAttempts,
    ] = await Promise.all([
      this.prisma.fileObject.count({
        where: { companyId, status: FileObjectStatus.SCAN_FAILED },
      }),
      this.prisma.fileObject.count({
        where: { companyId, status: FileObjectStatus.INFECTED },
      }),
      this.prisma.fileUploadSession.count({
        where: { companyId, status: 'EXPIRED' },
      }),
      this.prisma.fileObject.count({
        where: { companyId, status: FileObjectStatus.UNREFERENCED },
      }),
      this.prisma.fileObject.count({
        where: { companyId, status: FileObjectStatus.MISSING },
      }),
      this.prisma.fileOperationAttempt.count({
        where: {
          status: FileOperationStatus.DEAD_LETTER,
          fileObject: { companyId },
        },
      }),
      this.prisma.fileOperationAttempt.count({
        where: {
          status: {
            in: [FileOperationStatus.RETRY_WAIT, FileOperationStatus.PENDING],
          },
          fileObject: { companyId },
        },
      }),
    ]);

    return {
      scanFailures,
      infectedCount,
      expiredSessions,
      unreferencedObjects,
      missingObjects,
      deletionDeadLetters,
      retryableAttempts,
    };
  }

  /**
   * Clears SCAN_FAILED objects caused by known false positives (e.g. missing
   * MIME purpose allowlist). Does not touch INFECTED or CLEAN objects.
   */
  async clearFalseScanFailures(companyId: string): Promise<{
    clearedObjects: number;
    clearedAttempts: number;
  }> {
    const failed = await this.prisma.fileObject.findMany({
      where: {
        companyId,
        status: FileObjectStatus.SCAN_FAILED,
        clamAvResult: {
          in: ['FILE_TYPE_MISMATCH', 'SCAN_FAILED', 'CHECKSUM_MISMATCH'],
        },
      },
      select: { id: true },
    });
    if (failed.length === 0) {
      return { clearedObjects: 0, clearedAttempts: 0 };
    }
    const ids = failed.map((row) => row.id);
    const attempts = await this.prisma.fileOperationAttempt.deleteMany({
      where: { fileObjectId: { in: ids } },
    });
    await this.prisma.fileUploadSession.updateMany({
      where: { fileObjectId: { in: ids } },
      data: { fileObjectId: null },
    });
    const objects = await this.prisma.fileObject.deleteMany({
      where: { id: { in: ids } },
    });
    return {
      clearedObjects: objects.count,
      clearedAttempts: attempts.count,
    };
  }

  async listPolicies(companyId: string) {
    await this.features.assertStorageWritesAllowed(companyId, null);
    return this.prisma.fileRetentionPolicy.findMany({
      where: { companyId },
      orderBy: { retentionClass: 'asc' },
      select: {
        id: true,
        retentionClass: true,
        retentionRule: true,
        retentionValue: true,
        enabled: true,
        version: true,
        approvedAt: true,
        updatedAt: true,
      },
    });
  }

  async upsertPolicy(input: {
    companyId: string;
    actorUserId: string;
    retentionClass: string;
    retentionRule: string;
    retentionValue: number;
    enabled?: boolean;
    approve?: boolean;
  }) {
    await this.features.assertStorageWritesAllowed(input.companyId, null);
    const retentionClass = input.retentionClass as FileRetentionClass;
    if (!Object.values(FileRetentionClass).includes(retentionClass)) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    return this.prisma.fileRetentionPolicy.upsert({
      where: {
        companyId_retentionClass: {
          companyId: input.companyId,
          retentionClass,
        },
      },
      update: {
        retentionRule: input.retentionRule,
        retentionValue: input.retentionValue,
        enabled: input.enabled ?? false,
        lastUpdatedByUserId: input.actorUserId,
        version: { increment: 1 },
        ...(input.approve
          ? { approvedAt: new Date(), approvedByUserId: input.actorUserId }
          : {}),
      },
      create: {
        companyId: input.companyId,
        retentionClass,
        retentionRule: input.retentionRule,
        retentionValue: input.retentionValue,
        enabled: input.enabled ?? false,
        lastUpdatedByUserId: input.actorUserId,
        ...(input.approve
          ? { approvedAt: new Date(), approvedByUserId: input.actorUserId }
          : {}),
      },
    });
  }
}
