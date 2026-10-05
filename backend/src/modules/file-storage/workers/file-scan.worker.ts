import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileObjectStatus,
  FileOperationStatus,
  FileOperationType,
  FileUploadSessionStatus,
  Prisma,
} from '@prisma/client';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { ContentTypeDetectorService } from '../services/content-type-detector.service';
import { FileStorageFeatureService } from '../services/file-storage-feature.service';
import { ClamAvScannerWorker } from './clamav-scanner.worker';
import { shouldProcessFileScans } from './file-scan.policy';

const MAX_ATTEMPTS = 5;
const LEASE_MS = 5 * 60 * 1000;
const RETRY_BACKOFF_MS = 60 * 1000;

@Injectable()
export class FileScanWorker {
  private readonly logger = new Logger(FileScanWorker.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scanner: ClamAvScannerWorker,
    private readonly storage: S3StorageAdapter,
    private readonly mimeDetector: ContentTypeDetectorService,
    private readonly features: FileStorageFeatureService,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async processDueAttempts(limit = 10): Promise<number> {
    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (
      !shouldProcessFileScans(this.features.scanWorkerEnabled(), nodeEnv) ||
      this.running
    ) {
      return 0;
    }
    this.running = true;
    let processed = 0;
    try {
      const due = await this.claimDue(limit);
      for (const attempt of due) {
        await this.processAttempt(attempt.id);
        processed += 1;
      }
      await this.recoverAbandoned();
    } finally {
      this.running = false;
    }
    return processed;
  }

  private async claimDue(limit: number): Promise<Array<{ id: string }>> {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT id
        FROM file_operation_attempts
        WHERE "operationType" = 'SCAN'::"FileOperationType"
          AND status IN ('PENDING'::"FileOperationStatus", 'RETRY_WAIT'::"FileOperationStatus")
          AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
          AND ("leaseExpiresAt" IS NULL OR "leaseExpiresAt" <= ${now})
        ORDER BY "createdAt" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      `);

      const leaseExpiresAt = new Date(Date.now() + LEASE_MS);
      for (const row of rows) {
        await tx.fileOperationAttempt.update({
          where: { id: row.id },
          data: {
            status: FileOperationStatus.PROCESSING,
            startedAt: now,
            leaseExpiresAt,
            workerCorrelationId: crypto.randomUUID(),
          },
        });
      }
      return rows;
    });
  }

  private async recoverAbandoned(): Promise<void> {
    const now = new Date();
    await this.prisma.fileOperationAttempt.updateMany({
      where: {
        operationType: FileOperationType.SCAN,
        status: FileOperationStatus.PROCESSING,
        leaseExpiresAt: { lt: now },
      },
      data: {
        status: FileOperationStatus.RETRY_WAIT,
        nextAttemptAt: now,
        leaseExpiresAt: null,
        safeErrorCode: 'LEASE_EXPIRED',
      },
    });
  }

  private async processAttempt(attemptId: string): Promise<void> {
    const attempt = await this.prisma.fileOperationAttempt.findUnique({
      where: { id: attemptId },
      include: { fileObject: true },
    });
    if (!attempt?.fileObject) {
      return;
    }
    const fileObject = attempt.fileObject;

    // An entitlement can be removed after an upload was finalized but before
    // its scanner lease is claimed. Do not read or promote that Company's
    // quarantine object; release the lease so it can resume if the Company is
    // enabled again.
    if (
      !(await this.features.isScopeAllowed(
        fileObject.companyId,
        fileObject.branchId,
      ))
    ) {
      await this.deferDisabledCompanyAttempt(attempt.id, fileObject.id);
      return;
    }

    const claimedObject = await this.prisma.fileObject.updateMany({
      where: {
        id: fileObject.id,
        version: fileObject.version,
        status: {
          in: [FileObjectStatus.QUARANTINED, FileObjectStatus.SCANNING],
        },
      },
      data: {
        status: FileObjectStatus.SCANNING,
        version: { increment: 1 },
      },
    });
    if (claimedObject.count !== 1) {
      await this.completeAttempt(attempt.id, FileOperationStatus.SUCCEEDED, {
        safeErrorCode: 'ALREADY_PROCESSED',
      });
      return;
    }

    // Check immediately before scanner I/O as well. The first check protects
    // queued work; this one protects a lease raced by an administrator
    // disabling File Storage.
    if (
      !(await this.features.isScopeAllowed(
        fileObject.companyId,
        fileObject.branchId,
      ))
    ) {
      await this.deferDisabledCompanyAttempt(attempt.id, fileObject.id);
      return;
    }

    const result = await this.scanner.scanObjectKey(fileObject.objectKey);

    if (result.failed) {
      await this.failOrRetry(
        attempt.id,
        fileObject.id,
        result.safeErrorCode ?? 'SCAN_FAILED',
      );
      return;
    }

    if (result.infected) {
      await this.markTerminal(
        fileObject.id,
        attempt.id,
        FileObjectStatus.INFECTED,
        {
          clamAvResult: result.virusName ?? 'INFECTED',
          scannedAt: result.scannedAt,
          clamAvEngineVersion: result.engineVersion,
          clamAvSignatureVersion: result.signatureVersion,
          actualChecksumSha256: result.sha256Hex,
        },
      );
      return;
    }

    if (!result.sha256Hex || !result.magicBytes) {
      await this.failOrRetry(
        attempt.id,
        fileObject.id,
        'SCAN_EVIDENCE_MISSING',
      );
      return;
    }

    if (result.sha256Hex !== fileObject.expectedChecksumSha256) {
      await this.markTerminal(
        fileObject.id,
        attempt.id,
        FileObjectStatus.SCAN_FAILED,
        {
          clamAvResult: 'CHECKSUM_MISMATCH',
          scannedAt: result.scannedAt,
          actualChecksumSha256: result.sha256Hex,
        },
        'FILE_CHECKSUM_MISMATCH',
      );
      return;
    }

    const detectedMime = this.mimeDetector.detect(result.magicBytes);
    const session = await this.prisma.fileUploadSession.findFirst({
      where: { fileObjectId: fileObject.id },
    });
    if (
      !detectedMime ||
      !session ||
      !this.mimeDetector.isAllowed(
        session.purpose,
        detectedMime,
        fileObject.safeExtension,
      )
    ) {
      await this.markTerminal(
        fileObject.id,
        attempt.id,
        FileObjectStatus.SCAN_FAILED,
        {
          clamAvResult: 'FILE_TYPE_MISMATCH',
          scannedAt: result.scannedAt,
          detectedMimeType: detectedMime,
          actualChecksumSha256: result.sha256Hex,
        },
        'FILE_TYPE_MISMATCH',
      );
      return;
    }

    let cleanKey: string;
    try {
      // Scanning may take time. Never promote a quarantined object after the
      // Company becomes inactive or File Storage is withdrawn mid-scan.
      if (
        !(await this.features.isScopeAllowed(
          fileObject.companyId,
          fileObject.branchId,
        ))
      ) {
        await this.deferDisabledCompanyAttempt(attempt.id, fileObject.id);
        return;
      }
      cleanKey = await this.storage.copyToClean(
        fileObject.objectKey,
        fileObject.companyId,
        fileObject.branchId,
      );
    } catch (err) {
      this.logger.error(`Promote failed for ${fileObject.id}`, err);
      await this.failOrRetry(attempt.id, fileObject.id, 'PROMOTE_FAILED');
      return;
    }

    const promoted = await this.prisma.fileObject.updateMany({
      where: {
        id: fileObject.id,
        status: FileObjectStatus.SCANNING,
      },
      data: {
        status: FileObjectStatus.CLEAN,
        objectKey: cleanKey,
        actualChecksumSha256: result.sha256Hex,
        detectedMimeType: detectedMime,
        clamAvResult: 'CLEAN',
        scannedAt: result.scannedAt,
        clamAvEngineVersion: result.engineVersion,
        clamAvSignatureVersion: result.signatureVersion,
        version: { increment: 1 },
      },
    });

    if (promoted.count !== 1) {
      return;
    }

    await this.prisma.fileUploadSession.updateMany({
      where: { fileObjectId: fileObject.id },
      data: {
        status: FileUploadSessionStatus.CLEAN,
        finalizedAt: new Date(),
      },
    });
    await this.completeAttempt(attempt.id, FileOperationStatus.SUCCEEDED);

    try {
      await this.storage.deleteObject(fileObject.objectKey);
    } catch (err) {
      this.logger.warn(
        `Quarantine delete deferred for ${fileObject.id}: ${(err as Error).message}`,
      );
    }
  }

  private async failOrRetry(
    attemptId: string,
    fileObjectId: string,
    safeErrorCode: string,
  ): Promise<void> {
    const attempt = await this.prisma.fileOperationAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });
    if (attempt.attemptNo >= MAX_ATTEMPTS) {
      await this.markTerminal(
        fileObjectId,
        attemptId,
        FileObjectStatus.SCAN_FAILED,
        {
          clamAvResult: 'SCAN_FAILED',
          scannedAt: new Date(),
        },
      );
      await this.prisma.fileOperationAttempt.update({
        where: { id: attemptId },
        data: {
          status: FileOperationStatus.DEAD_LETTER,
          safeErrorCode,
          completedAt: new Date(),
          leaseExpiresAt: null,
        },
      });
      return;
    }

    await this.prisma.fileObject.update({
      where: { id: fileObjectId },
      data: { status: FileObjectStatus.QUARANTINED },
    });
    await this.prisma.fileOperationAttempt.update({
      where: { id: attemptId },
      data: {
        status: FileOperationStatus.RETRY_WAIT,
        safeErrorCode,
        attemptNo: attempt.attemptNo + 1,
        nextAttemptAt: new Date(
          Date.now() + RETRY_BACKOFF_MS * attempt.attemptNo,
        ),
        leaseExpiresAt: null,
      },
    });
  }

  /**
   * Entitlement removal is not a scanner failure. Preserve the quarantine
   * object and the session's UPLOADED state, restore the object from SCANNING
   * if this worker claimed it, and release the processing lease for a future
   * eligible retry.
   */
  private async deferDisabledCompanyAttempt(
    attemptId: string,
    fileObjectId: string,
  ): Promise<void> {
    const nextAttemptAt = new Date(Date.now() + RETRY_BACKOFF_MS);
    await this.prisma.fileObject.updateMany({
      where: {
        id: fileObjectId,
        status: FileObjectStatus.SCANNING,
      },
      data: {
        status: FileObjectStatus.QUARANTINED,
      },
    });
    await this.prisma.fileOperationAttempt.updateMany({
      where: {
        id: attemptId,
        status: FileOperationStatus.PROCESSING,
      },
      data: {
        status: FileOperationStatus.RETRY_WAIT,
        nextAttemptAt,
        leaseExpiresAt: null,
        safeErrorCode: 'FILE_STORAGE_MODULE_NOT_ENABLED',
      },
    });
  }

  private async markTerminal(
    fileObjectId: string,
    attemptId: string,
    status: FileObjectStatus,
    extra: Record<string, unknown>,
    safeErrorCode?: string,
  ): Promise<void> {
    await this.prisma.fileObject.update({
      where: { id: fileObjectId },
      data: {
        status,
        ...extra,
      },
    });
    await this.prisma.fileUploadSession.updateMany({
      where: { fileObjectId },
      data: { status: FileUploadSessionStatus.REJECTED },
    });
    await this.completeAttempt(
      attemptId,
      FileOperationStatus.SUCCEEDED,
      safeErrorCode ? { safeErrorCode } : undefined,
    );
  }

  private async completeAttempt(
    attemptId: string,
    status: FileOperationStatus,
    extra?: { safeErrorCode?: string },
  ): Promise<void> {
    await this.prisma.fileOperationAttempt.updateMany({
      where: {
        id: attemptId,
        status: FileOperationStatus.PROCESSING,
      },
      data: {
        status,
        completedAt: new Date(),
        leaseExpiresAt: null,
        safeErrorCode: extra?.safeErrorCode ?? null,
      },
    });
  }
}
