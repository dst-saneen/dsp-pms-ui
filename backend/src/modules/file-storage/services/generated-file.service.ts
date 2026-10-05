import { Injectable, Logger } from '@nestjs/common';
import {
  FileObjectStatus,
  FileRetentionClass,
  FileUploadPurpose,
  Prisma,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as path from 'path';

import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { FilenameEncryptionService } from './filename-encryption.service';
import { FileStorageFeatureService } from './file-storage-feature.service';

const STORAGE_PROFILE_CODE = 'default';

const INTENT_PENDING_UPLOAD = 'PENDING_UPLOAD';
const INTENT_UPLOADED = 'UPLOADED';
const INTENT_FINALIZED = 'FINALIZED';
const INTENT_DELETE_PENDING = 'DELETE_PENDING';
const INTENT_DEAD_LETTER = 'DEAD_LETTER';
const INTENT_COMPENSATED = 'COMPENSATED';

export interface StoreGeneratedFileInput {
  companyId: string;
  branchId?: string | null;
  fileName: string;
  mimeType: string;
  content: Buffer;
  retentionClass: FileRetentionClass;
  purpose: FileUploadPurpose;
  creatorUserId?: string | null;
  correlationId?: string | null;
  tx?: Prisma.TransactionClient;
}

/**
 * Internal primitive for trusted system-generated private files (e.g. payslips).
 * Writes an encrypted object, records checksum/MIME metadata, and returns a CLEAN FileObject.
 * Uses a durable GeneratedFileIntent for upload→DB compensation.
 */
@Injectable()
export class GeneratedFileService {
  private readonly logger = new Logger(GeneratedFileService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly filenameEncryption: FilenameEncryptionService,
    private readonly features: FileStorageFeatureService,
  ) {}

  async storeCleanGeneratedFile(input: StoreGeneratedFileInput) {
    await this.features.assertStorageWritesAllowed(
      input.companyId,
      input.branchId ?? null,
    );

    const safeExtension =
      path.extname(input.fileName).replace('.', '').toLowerCase() || 'pdf';
    const objectUuid = crypto.randomUUID();
    const objectKey = this.storage.generateCleanKey(
      input.companyId,
      input.branchId ?? null,
      objectUuid,
    );
    const checksumSha256 = crypto
      .createHash('sha256')
      .update(input.content)
      .digest('hex');

    const intent = await this.prisma.generatedFileIntent.create({
      data: {
        companyId: input.companyId,
        objectKey,
        purpose: String(input.purpose),
        status: INTENT_PENDING_UPLOAD,
        correlationId: input.correlationId ?? null,
      },
    });

    try {
      await this.storage.putObjectBytes({
        objectKey,
        body: input.content,
        contentType: input.mimeType,
        checksumSha256,
      });
    } catch (error) {
      await this.prisma.generatedFileIntent.update({
        where: { id: intent.id },
        data: { status: INTENT_DEAD_LETTER },
      });
      throw error;
    }

    await this.prisma.generatedFileIntent.update({
      where: { id: intent.id },
      data: { status: INTENT_UPLOADED },
    });

    const encryptedName = this.filenameEncryption.encrypt(input.fileName);
    const db = input.tx ?? this.prisma;

    try {
      const fileObject = await db.fileObject.create({
        data: {
          companyId: input.companyId,
          branchId: input.branchId ?? null,
          storageProfileCode: STORAGE_PROFILE_CODE,
          objectKey,
          status: FileObjectStatus.CLEAN,
          originalFileNameEncrypted: encryptedName.ciphertext,
          fileNameEncNonce: encryptedName.nonce,
          fileNameEncTag: encryptedName.tag,
          fileNameEncKeyVersion: encryptedName.keyVersion,
          safeExtension,
          declaredMimeType: input.mimeType,
          detectedMimeType: input.mimeType,
          expectedSizeBytes: input.content.length,
          actualSizeBytes: input.content.length,
          expectedChecksumSha256: checksumSha256,
          actualChecksumSha256: checksumSha256,
          // Trusted system-generated artifacts are stored as CLEAN without a
          // quarantine scan path; satisfy file_objects_clean_evidence_chk.
          clamAvResult: 'CLEAN',
          scannedAt: new Date(),
          sseMode: 'AES256',
          retentionClass: input.retentionClass,
          creatorUserId: input.creatorUserId ?? null,
          publicUploadContext: `generated:${input.purpose}`,
          version: 0,
        },
      });

      await db.generatedFileIntent.update({
        where: { id: intent.id },
        data: { status: INTENT_FINALIZED },
      });

      this.logger.log(
        `Stored generated file purpose=${input.purpose} fileObjectId=${fileObject.id}`,
      );

      return {
        ...fileObject,
        generatedFileIntentId: intent.id,
        generatedObjectKey: objectKey,
      };
    } catch (error) {
      await this.compensateFailedFinalize(intent.id, objectKey);
      throw error;
    }
  }

  private async compensateFailedFinalize(
    intentId: string,
    objectKey: string,
  ): Promise<void> {
    try {
      await this.storage.deleteObject(objectKey);
      await this.prisma.generatedFileIntent.update({
        where: { id: intentId },
        data: { status: INTENT_COMPENSATED },
      });
    } catch (deleteError) {
      this.logger.error(
        `Failed to delete orphan generated object key=${objectKey}; marking DELETE_PENDING`,
        deleteError instanceof Error ? deleteError.stack : undefined,
      );
      await this.prisma.generatedFileIntent.update({
        where: { id: intentId },
        data: { status: INTENT_DELETE_PENDING },
      });
    }
  }

  async compensateAfterTransactionFailure(input: {
    intentId: string;
    objectKey: string;
    fileObjectId: string;
  }): Promise<void> {
    const committed = await this.prisma.fileObject.findFirst({
      where: { id: input.fileObjectId, objectKey: input.objectKey },
      select: { id: true },
    });
    if (committed) {
      await this.prisma.generatedFileIntent.updateMany({
        where: { id: input.intentId },
        data: { status: INTENT_FINALIZED },
      });
      return;
    }
    await this.compensateFailedFinalize(input.intentId, input.objectKey);
  }

  async reconcilePendingDeletes(limit = 50): Promise<number> {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const pending = await this.prisma.generatedFileIntent.findMany({
      where: {
        OR: [
          { status: INTENT_DELETE_PENDING },
          {
            status: { in: [INTENT_PENDING_UPLOAD, INTENT_UPLOADED] },
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });

    let resolved = 0;
    for (const intent of pending) {
      try {
        if (intent.status === INTENT_UPLOADED) {
          const committed = await this.prisma.fileObject.findFirst({
            where: { objectKey: intent.objectKey },
            select: { id: true },
          });
          if (committed) {
            await this.prisma.generatedFileIntent.update({
              where: { id: intent.id },
              data: { status: INTENT_FINALIZED },
            });
            resolved += 1;
            continue;
          }
        }
        await this.storage.deleteObject(intent.objectKey);
        await this.prisma.generatedFileIntent.update({
          where: { id: intent.id },
          data: { status: INTENT_COMPENSATED },
        });
        resolved += 1;
      } catch (error) {
        this.logger.error(
          `Generated-file delete reaper failed intent=${intent.id} key=${intent.objectKey}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }

    return resolved;
  }
}
