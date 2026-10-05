import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  FileObjectStatus,
  FileUploadSessionStatus,
  FileUploadPurpose,
  FileOperationType,
  FileOperationStatus,
} from '@prisma/client';
import * as path from 'path';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import {
  canonicalUploadRequestDigest,
  hashPublicSessionToken,
  newPublicSessionToken,
  sha256Hex,
  timingSafeEqualText,
} from '../file-storage.crypto';
import { FilenameEncryptionService } from './filename-encryption.service';
import { FileStorageFeatureService } from './file-storage-feature.service';
import { FileScanWorker } from '../workers/file-scan.worker';
import { shouldProcessFileScans } from '../workers/file-scan.policy';

const ALLOWED_EXTENSIONS_BY_PURPOSE: Record<string, string[]> = {
  CV: ['pdf', 'doc', 'docx'],
  SUPPORTING: ['pdf', 'doc', 'docx'],
  SIGNED_OFFER: ['pdf'],
  GENERATED_OFFER: ['pdf'],
  EMPLOYEE_DOCUMENT: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
  FINANCE_RECEIPT: ['pdf', 'jpg', 'jpeg', 'png'],
  PAYROLL_PAYSLIP: ['pdf'],
  PROJECT_SUPPORTING: [
    'pdf',
    'doc',
    'docx',
    'jpg',
    'jpeg',
    'png',
    'xlsx',
    'xls',
  ],
  HR_REQUEST_ATTACHMENT: ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'],
};

const MAX_SIZE_BYTES_BY_PURPOSE: Record<string, number> = {
  CV: 10 * 1024 * 1024,
  SUPPORTING: 10 * 1024 * 1024,
  SIGNED_OFFER: 10 * 1024 * 1024,
  GENERATED_OFFER: 10 * 1024 * 1024,
  EMPLOYEE_DOCUMENT: 25 * 1024 * 1024,
  FINANCE_RECEIPT: 15 * 1024 * 1024,
  PAYROLL_PAYSLIP: 10 * 1024 * 1024,
  PROJECT_SUPPORTING: 25 * 1024 * 1024,
  HR_REQUEST_ATTACHMENT: 25 * 1024 * 1024,
};

const STORAGE_PROFILE_CODE = 'default';

export interface CreateUploadSessionInput {
  companyId: string;
  branchId: string | null;
  purpose: FileUploadPurpose;
  jobOpeningId?: string;
  jobApplicationId?: string;
  employeeId?: string;
  jobOfferId?: string;
  projectId?: string;
  taskId?: string;
  applicationOperationId?: string;
  fileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  operationId: string;
  creatorUserId?: string;
  issuePublicSessionToken?: boolean;
}

export interface UploadSessionResponse {
  id: string;
  version: number;
  status: string;
  sessionToken?: string;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  } | null;
  scan: {
    status: string;
    safeErrorCode: string | null;
    fileObjectStatus?: string | null;
  };
  fileObjectId: string | null;
  allowedActions: string[];
}

interface UploadSessionScope {
  jobOpeningId?: string;
  publicOpeningOnly?: boolean;
  jobOfferId?: string;
  publicOfferOnly?: boolean;
}

@Injectable()
export class FileUploadSessionService {
  private readonly logger = new Logger(FileUploadSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly filenameEncryption: FilenameEncryptionService,
    private readonly features: FileStorageFeatureService,
    private readonly fileScanWorker: FileScanWorker,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  async createSession(
    input: CreateUploadSessionInput,
  ): Promise<UploadSessionResponse> {
    await this.features.assertStorageWritesAllowed(
      input.companyId,
      input.branchId,
    );
    this.validateMetadata(input);

    const digest = canonicalUploadRequestDigest({
      purpose: input.purpose,
      jobOpeningId: input.jobOpeningId,
      jobApplicationId: input.jobApplicationId,
      employeeId: input.employeeId,
      jobOfferId: input.jobOfferId,
      projectId: input.projectId,
      taskId: input.taskId,
      applicationOperationId: input.applicationOperationId,
      fileName: input.fileName,
      declaredMimeType: input.declaredMimeType,
      sizeBytes: input.sizeBytes,
      checksumSha256: input.checksumSha256,
      operationId: input.operationId,
    });

    const existing = await this.prisma.fileUploadSession.findUnique({
      where: {
        companyId_operationId: {
          companyId: input.companyId,
          operationId: input.operationId,
        },
      },
    });

    if (existing) {
      if (existing.requestDigest && existing.requestDigest !== digest) {
        throw new ConflictException({ code: 'OPERATION_ID_REUSED' });
      }
      if (existing.status !== FileUploadSessionStatus.ISSUED) {
        throw new ConflictException({ code: 'OPERATION_ID_REUSED' });
      }
      return this.reissueGrant(
        existing,
        input.issuePublicSessionToken === true,
      );
    }

    const quarantineKey = this.storage.generateQuarantineKey(
      input.companyId,
      input.branchId,
    );
    const publicToken = input.issuePublicSessionToken
      ? newPublicSessionToken()
      : null;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const presigned = await this.storage.createPresignedPut(
      quarantineKey,
      input.declaredMimeType,
      input.sizeBytes,
      input.checksumSha256,
    );

    // The presigned grant is created outside the database transaction. Check
    // the live entitlement again before persisting a session which could later
    // be used after an administrator has disabled File Storage.
    await this.features.assertStorageAvailable(input.companyId, input.branchId);

    const session = await this.prisma.fileUploadSession.create({
      data: {
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        purpose: input.purpose,
        jobOpeningId: input.jobOpeningId ?? null,
        jobApplicationId: input.jobApplicationId ?? null,
        employeeId: input.employeeId ?? null,
        jobOfferId: input.jobOfferId ?? null,
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
        applicationOperationId: input.applicationOperationId ?? null,
        expectedFileName: input.fileName,
        safeExtension: this.safeExt(input.fileName),
        declaredMimeType: input.declaredMimeType,
        expectedSizeBytes: input.sizeBytes,
        expectedChecksumSha256: input.checksumSha256.toLowerCase(),
        quarantineObjectKey: quarantineKey,
        publicSessionTokenHash: publicToken
          ? hashPublicSessionToken(publicToken)
          : null,
        requestDigest: digest,
        creatorUserId: input.creatorUserId ?? null,
        status: FileUploadSessionStatus.ISSUED,
        expiresAt,
        operationId: input.operationId,
      },
    });

    return {
      ...this.toSessionResponse(session, {
        includeUpload: true,
        presigned,
      }),
      ...(publicToken ? { sessionToken: publicToken } : {}),
    };
  }

  async finalizeSession(
    sessionId: string,
    companyId: string,
    actorUserId?: string,
    publicSessionToken?: string,
    scope?: UploadSessionScope,
  ): Promise<UploadSessionResponse> {
    await this.features.assertStorageAvailable(companyId, null);

    const response = await this.prisma.$transaction(async (tx) => {
      const session = await tx.fileUploadSession.findFirst({
        where: {
          id: sessionId,
          companyId,
          ...this.sessionScopeWhere(scope),
        },
        include: { fileObject: true },
      });
      if (!session) {
        throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
      }

      this.assertSessionAuth(session, actorUserId, publicSessionToken);
      await this.assertSessionStorageAvailable(session);

      if (
        session.status === FileUploadSessionStatus.CLEAN ||
        session.status === FileUploadSessionStatus.UPLOADED ||
        session.status === FileUploadSessionStatus.FINALIZING
      ) {
        return this.toSessionResponse(session, { includeUpload: false });
      }

      if (
        session.status === FileUploadSessionStatus.EXPIRED ||
        new Date() > session.expiresAt
      ) {
        await tx.fileUploadSession.update({
          where: { id: session.id },
          data: { status: FileUploadSessionStatus.EXPIRED },
        });
        throw new BadRequestException({ code: 'UPLOAD_SESSION_EXPIRED' });
      }

      if (session.status !== FileUploadSessionStatus.ISSUED) {
        throw new ConflictException({ code: 'FILE_STATE_CHANGED' });
      }

      const claimed = await tx.fileUploadSession.updateMany({
        where: {
          id: session.id,
          version: session.version,
          status: FileUploadSessionStatus.ISSUED,
        },
        data: {
          status: FileUploadSessionStatus.FINALIZING,
          uploadedAt: new Date(),
          version: { increment: 1 },
        },
      });
      if (claimed.count !== 1) {
        const latest = await tx.fileUploadSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        return this.toSessionResponse(latest, { includeUpload: false });
      }

      const meta = await this.storage.headObject(session.quarantineObjectKey);
      if (!meta) {
        await tx.fileUploadSession.update({
          where: { id: session.id },
          data: { status: FileUploadSessionStatus.REJECTED },
        });
        throw new BadRequestException({ code: 'FILE_NOT_FOUND' });
      }
      if (!this.storage.isQuarantineKey(session.quarantineObjectKey)) {
        throw new BadRequestException({ code: 'UPLOAD_SCOPE_MISMATCH' });
      }
      if (meta.sizeBytes !== session.expectedSizeBytes) {
        await tx.fileUploadSession.update({
          where: { id: session.id },
          data: { status: FileUploadSessionStatus.REJECTED },
        });
        throw new BadRequestException({ code: 'FILE_SIZE_MISMATCH' });
      }
      if (
        meta.checksumSha256 &&
        meta.checksumSha256 !== session.expectedChecksumSha256
      ) {
        await tx.fileUploadSession.update({
          where: { id: session.id },
          data: { status: FileUploadSessionStatus.REJECTED },
        });
        throw new BadRequestException({ code: 'FILE_CHECKSUM_MISMATCH' });
      }
      if (meta.sseMode !== 'AES256') {
        await tx.fileUploadSession.update({
          where: { id: session.id },
          data: { status: FileUploadSessionStatus.REJECTED },
        });
        throw new BadRequestException({ code: 'FILE_NOT_CLEAN' });
      }

      const encryptedName = this.filenameEncryption.encrypt(
        session.expectedFileName,
      );

      // This is the final application-level authorization boundary before the
      // file becomes a durable FileObject and scan work is enqueued.
      await this.assertSessionStorageAvailable(session);

      const fileObject = await tx.fileObject.create({
        data: {
          companyId: session.companyId,
          branchId: session.branchId,
          storageProfileCode: STORAGE_PROFILE_CODE,
          objectKey: session.quarantineObjectKey,
          status: FileObjectStatus.QUARANTINED,
          originalFileNameEncrypted: encryptedName.ciphertext,
          fileNameEncNonce: encryptedName.nonce,
          fileNameEncTag: encryptedName.tag,
          fileNameEncKeyVersion: encryptedName.keyVersion,
          safeExtension: session.safeExtension,
          declaredMimeType: session.declaredMimeType,
          expectedSizeBytes: session.expectedSizeBytes,
          actualSizeBytes: meta.sizeBytes,
          expectedChecksumSha256: session.expectedChecksumSha256,
          sseMode: meta.sseMode,
          creatorUserId: actorUserId ?? null,
          version: 0,
        },
      });

      await tx.fileUploadSession.update({
        where: { id: session.id },
        data: {
          fileObjectId: fileObject.id,
          status: FileUploadSessionStatus.UPLOADED,
        },
      });

      await tx.fileOperationAttempt.create({
        data: {
          fileObjectId: fileObject.id,
          operationType: FileOperationType.SCAN,
          attemptNo: 1,
          status: FileOperationStatus.PENDING,
          nextAttemptAt: new Date(),
        },
      });

      const updated = await tx.fileUploadSession.findUniqueOrThrow({
        where: { id: session.id },
      });
      return this.toSessionResponse(updated, { includeUpload: false });
    });

    const nodeEnv = this.config.get('NODE_ENV', { infer: true });
    if (
      shouldProcessFileScans(this.features.scanWorkerEnabled(), nodeEnv) &&
      (response.status === FileUploadSessionStatus.UPLOADED ||
        response.status === FileUploadSessionStatus.FINALIZING)
    ) {
      try {
        await this.fileScanWorker.processDueAttempts(10);
      } catch (error) {
        this.logger.warn({
          event: 'file-storage.scan.inline-failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
      return this.getSession(
        sessionId,
        companyId,
        actorUserId,
        publicSessionToken,
        scope,
      );
    }

    return response;
  }

  /**
   * Anonymous career uploads are capability-scoped to one opening. Keep this
   * check in the service (rather than only in the route) so a session token
   * issued for one opening cannot be replayed through another opening URL.
   */
  async finalizePublicOpeningSession(input: {
    sessionId: string;
    companyId: string;
    jobOpeningId: string;
    publicSessionToken?: string;
  }): Promise<UploadSessionResponse> {
    return this.finalizeSession(
      input.sessionId,
      input.companyId,
      undefined,
      input.publicSessionToken,
      {
        jobOpeningId: input.jobOpeningId,
        publicOpeningOnly: true,
      },
    );
  }

  /**
   * A signed-offer token is capability-scoped to one JobOffer. Keep that
   * binding in the service so another offer in the same Company cannot replay
   * the session token through a different public offer URL.
   */
  async finalizePublicOfferSession(input: {
    sessionId: string;
    companyId: string;
    jobOfferId: string;
    publicSessionToken?: string;
  }): Promise<UploadSessionResponse> {
    return this.finalizeSession(
      input.sessionId,
      input.companyId,
      undefined,
      input.publicSessionToken,
      {
        jobOfferId: input.jobOfferId,
        publicOfferOnly: true,
      },
    );
  }

  async putPublicSessionObject(input: {
    sessionId: string;
    companyId: string;
    jobOfferId: string;
    publicSessionToken?: string;
    body: Buffer;
    contentType?: string;
  }): Promise<void> {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: input.sessionId,
        companyId: input.companyId,
        jobOfferId: input.jobOfferId,
        purpose: FileUploadPurpose.SIGNED_OFFER,
      },
    });
    if (!session) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    this.assertSessionAuth(session, undefined, input.publicSessionToken);
    await this.writeSessionObjectBytes(session, input.body, input.contentType);
  }

  async getPublicOpeningSession(input: {
    sessionId: string;
    companyId: string;
    jobOpeningId: string;
    publicSessionToken?: string;
  }): Promise<UploadSessionResponse> {
    return this.getSession(
      input.sessionId,
      input.companyId,
      undefined,
      input.publicSessionToken,
      {
        jobOpeningId: input.jobOpeningId,
        publicOpeningOnly: true,
      },
    );
  }

  /**
   * Browser→S3 direct PUT requires bucket CORS. When CORS is unavailable,
   * clients upload through this authenticated proxy instead.
   */
  async putAuthenticatedSessionObject(input: {
    sessionId: string;
    companyId: string;
    actorUserId: string;
    body: Buffer;
    contentType?: string;
  }): Promise<void> {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: input.sessionId,
        companyId: input.companyId,
      },
    });
    if (!session) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    this.assertSessionAuth(session, input.actorUserId, undefined);
    await this.writeSessionObjectBytes(session, input.body, input.contentType);
  }

  private async writeSessionObjectBytes(
    session: {
      id: string;
      companyId: string;
      branchId: string | null;
      status: FileUploadSessionStatus;
      expiresAt: Date;
      expectedSizeBytes: number;
      expectedChecksumSha256: string;
      declaredMimeType: string;
      quarantineObjectKey: string;
    },
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    if (
      session.status === FileUploadSessionStatus.EXPIRED ||
      new Date() > session.expiresAt
    ) {
      throw new BadRequestException({ code: 'UPLOAD_SESSION_EXPIRED' });
    }

    if (session.status !== FileUploadSessionStatus.ISSUED) {
      throw new ConflictException({ code: 'FILE_STATE_CHANGED' });
    }

    if (body.length !== session.expectedSizeBytes) {
      throw new BadRequestException({ code: 'FILE_SIZE_MISMATCH' });
    }

    const digest = sha256Hex(body);
    if (digest !== session.expectedChecksumSha256) {
      throw new BadRequestException({ code: 'FILE_CHECKSUM_MISMATCH' });
    }

    const declaredType = session.declaredMimeType.toLowerCase();
    const incomingType = (contentType ?? '')
      .split(';')[0]
      ?.trim()
      .toLowerCase();
    if (
      incomingType &&
      incomingType !== declaredType &&
      incomingType !== 'application/octet-stream'
    ) {
      throw new BadRequestException({ code: 'FILE_TYPE_MISMATCH' });
    }

    // Direct PUT proxies must re-evaluate entitlement immediately before the
    // object-store write. This invalidates an already-issued session when the
    // Company is disabled or File Storage is withdrawn.
    await this.assertSessionStorageAvailable(session);

    await this.storage.putObjectBytes({
      objectKey: session.quarantineObjectKey,
      body,
      contentType: session.declaredMimeType,
      checksumSha256: session.expectedChecksumSha256,
    });
  }

  async getSession(
    sessionId: string,
    companyId: string,
    actorUserId?: string,
    publicSessionToken?: string,
    scope?: UploadSessionScope,
  ): Promise<UploadSessionResponse> {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: sessionId,
        companyId,
        ...this.sessionScopeWhere(scope),
      },
      include: {
        fileObject: {
          select: {
            id: true,
            status: true,
            clamAvResult: true,
            operationAttempts: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { safeErrorCode: true },
            },
          },
        },
      },
    });
    if (!session) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    this.assertSessionAuth(session, actorUserId, publicSessionToken);
    await this.assertSessionStorageAvailable(session);
    return this.toSessionResponse(session, { includeUpload: false });
  }

  private sessionScopeWhere(scope?: UploadSessionScope) {
    if (scope?.publicOpeningOnly && scope.jobOpeningId) {
      return {
        jobOpeningId: scope.jobOpeningId,
        jobApplicationId: null,
        jobOfferId: null,
        purpose: {
          in: [FileUploadPurpose.CV, FileUploadPurpose.SUPPORTING],
        },
      };
    }

    if (scope?.publicOfferOnly && scope.jobOfferId) {
      return {
        jobOfferId: scope.jobOfferId,
        purpose: FileUploadPurpose.SIGNED_OFFER,
      };
    }

    return {};
  }

  async cancelSession(
    sessionId: string,
    companyId: string,
    actorUserId?: string,
    publicSessionToken?: string,
    scope?: UploadSessionScope,
  ): Promise<UploadSessionResponse> {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: sessionId,
        companyId,
        ...this.sessionScopeWhere(scope),
      },
    });
    if (!session) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    this.assertSessionAuth(session, actorUserId, publicSessionToken);
    await this.assertSessionStorageAvailable(session);

    if (
      session.status !== FileUploadSessionStatus.ISSUED &&
      session.status !== FileUploadSessionStatus.UPLOADED
    ) {
      throw new ConflictException({ code: 'FILE_STATE_CHANGED' });
    }

    const updated = await this.prisma.fileUploadSession.update({
      where: { id: session.id },
      data: { status: FileUploadSessionStatus.CANCELLED },
    });
    return this.toSessionResponse(updated, { includeUpload: false });
  }

  async cancelPublicOfferSession(input: {
    sessionId: string;
    companyId: string;
    jobOfferId: string;
    publicSessionToken?: string;
  }): Promise<UploadSessionResponse> {
    return this.cancelSession(
      input.sessionId,
      input.companyId,
      undefined,
      input.publicSessionToken,
      {
        jobOfferId: input.jobOfferId,
        publicOfferOnly: true,
      },
    );
  }

  async getPublicOfferSession(input: {
    sessionId: string;
    companyId: string;
    jobOfferId: string;
    publicSessionToken?: string;
  }): Promise<UploadSessionResponse> {
    return this.getSession(
      input.sessionId,
      input.companyId,
      undefined,
      input.publicSessionToken,
      {
        jobOfferId: input.jobOfferId,
        publicOfferOnly: true,
      },
    );
  }

  async requireCleanSession(input: {
    sessionId: string;
    companyId: string;
    purpose: FileUploadPurpose;
    employeeId?: string;
    jobOfferId?: string;
    jobApplicationId?: string;
    jobOpeningId?: string;
    projectId?: string;
    taskId?: string;
    actorUserId?: string;
  }) {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: input.sessionId,
        companyId: input.companyId,
        purpose: input.purpose,
      },
      include: { fileObject: true },
    });
    if (!session || !session.fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    await this.assertSessionStorageAvailable(session);
    if (input.employeeId && session.employeeId !== input.employeeId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (input.jobOfferId && session.jobOfferId !== input.jobOfferId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (
      input.jobApplicationId &&
      session.jobApplicationId !== input.jobApplicationId
    ) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (input.projectId && session.projectId !== input.projectId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (input.taskId && session.taskId !== input.taskId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (session.status !== FileUploadSessionStatus.CLEAN) {
      throw new BadRequestException({
        code:
          session.status === FileUploadSessionStatus.UPLOADED ||
          session.status === FileUploadSessionStatus.FINALIZING
            ? 'FILE_SCAN_PENDING'
            : 'FILE_NOT_CLEAN',
      });
    }
    if (session.fileObject.status !== FileObjectStatus.CLEAN) {
      throw new BadRequestException({ code: 'FILE_NOT_CLEAN' });
    }
    if (
      input.actorUserId &&
      (!session.creatorUserId ||
        session.creatorUserId !== input.actorUserId ||
        session.fileObject.creatorUserId !== input.actorUserId)
    ) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    if (session.fileObject.branchId !== session.branchId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
    return session;
  }

  private async reissueGrant(
    session: {
      id: string;
      companyId: string;
      branchId: string | null;
      version: number;
      status: FileUploadSessionStatus;
      declaredMimeType: string;
      expectedSizeBytes: number;
      expectedChecksumSha256: string;
      quarantineObjectKey: string;
      fileObjectId: string | null;
    },
    rotatePublicToken: boolean,
  ): Promise<UploadSessionResponse> {
    await this.assertSessionStorageAvailable(session);
    const presigned = await this.storage.createPresignedPut(
      session.quarantineObjectKey,
      session.declaredMimeType,
      session.expectedSizeBytes,
      session.expectedChecksumSha256,
    );

    let sessionToken: string | undefined;
    if (rotatePublicToken) {
      sessionToken = newPublicSessionToken();
      await this.prisma.fileUploadSession.update({
        where: { id: session.id },
        data: { publicSessionTokenHash: hashPublicSessionToken(sessionToken) },
      });
    }

    return {
      ...this.toSessionResponse(session, { includeUpload: true, presigned }),
      ...(sessionToken ? { sessionToken } : {}),
    };
  }

  private async assertSessionStorageAvailable(session: {
    companyId: string;
    branchId: string | null;
  }): Promise<void> {
    await this.features.assertStorageAvailable(
      session.companyId,
      session.branchId,
    );
  }

  private assertSessionAuth(
    session: {
      publicSessionTokenHash: string | null;
      creatorUserId?: string | null;
    },
    actorUserId?: string,
    publicSessionToken?: string,
  ) {
    if (session.publicSessionTokenHash) {
      if (!publicSessionToken) {
        throw new ForbiddenException({ code: 'UPLOAD_SCOPE_MISMATCH' });
      }
      const provided = hashPublicSessionToken(publicSessionToken);
      if (!timingSafeEqualText(provided, session.publicSessionTokenHash)) {
        throw new ForbiddenException({ code: 'UPLOAD_SCOPE_MISMATCH' });
      }
      return;
    }
    if (!actorUserId) {
      throw new ForbiddenException({ code: 'UPLOAD_SCOPE_MISMATCH' });
    }
    if (!session.creatorUserId || session.creatorUserId !== actorUserId) {
      throw new ForbiddenException({ code: 'UPLOAD_SCOPE_MISMATCH' });
    }
  }

  private validateMetadata(input: CreateUploadSessionInput) {
    const safeExt = this.safeExt(input.fileName);
    const allowedExts = ALLOWED_EXTENSIONS_BY_PURPOSE[input.purpose] ?? [];
    if (!allowedExts.includes(safeExt)) {
      throw new BadRequestException({ code: 'FILE_TYPE_MISMATCH' });
    }
    const maxSize =
      MAX_SIZE_BYTES_BY_PURPOSE[input.purpose] ?? 10 * 1024 * 1024;
    if (input.sizeBytes > maxSize) {
      throw new BadRequestException({ code: 'FILE_SIZE_MISMATCH' });
    }
    if (!/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
      throw new BadRequestException({ code: 'FILE_CHECKSUM_MISMATCH' });
    }
  }

  private safeExt(fileName: string): string {
    return path.extname(fileName).replace('.', '').toLowerCase();
  }

  private toSessionResponse(
    session: {
      id: string;
      version: number;
      status: FileUploadSessionStatus;
      fileObjectId: string | null;
      fileObject?: {
        status?: string | null;
        clamAvResult?: string | null;
        operationAttempts?: Array<{ safeErrorCode: string | null }>;
      } | null;
    },
    options: {
      includeUpload: boolean;
      presigned?: {
        url: string;
        headers: Record<string, string>;
        expiresAt: Date;
      };
    },
  ): UploadSessionResponse {
    const status = session.status;
    const allowedActions: string[] = [];
    if (status === FileUploadSessionStatus.ISSUED) {
      allowedActions.push('UPLOAD', 'FINALIZE', 'CANCEL');
    } else if (status === FileUploadSessionStatus.UPLOADED) {
      allowedActions.push('CANCEL');
    }

    const fileObjectStatus = session.fileObject?.status ?? null;
    const attemptCode =
      session.fileObject?.operationAttempts?.[0]?.safeErrorCode ?? null;

    let scanStatus =
      status === FileUploadSessionStatus.CLEAN
        ? 'CLEAN'
        : status === FileUploadSessionStatus.REJECTED
          ? 'REJECTED'
          : status === FileUploadSessionStatus.UPLOADED ||
              status === FileUploadSessionStatus.FINALIZING
            ? 'SCANNING'
            : 'NOT_STARTED';

    let safeErrorCode: string | null = null;

    if (status === FileUploadSessionStatus.REJECTED) {
      if (fileObjectStatus === FileObjectStatus.INFECTED) {
        scanStatus = 'INFECTED';
        safeErrorCode = 'FILE_INFECTED';
      } else if (fileObjectStatus === FileObjectStatus.SCAN_FAILED) {
        const unavailable =
          attemptCode === 'CLAMAV_UNAVAILABLE' ||
          attemptCode === 'CLAMAV_TIMEOUT' ||
          attemptCode === 'CLAMAV_STREAM_FAILED';
        const fromClam =
          session.fileObject?.clamAvResult === 'FILE_TYPE_MISMATCH'
            ? 'FILE_TYPE_MISMATCH'
            : session.fileObject?.clamAvResult === 'CHECKSUM_MISMATCH'
              ? 'FILE_CHECKSUM_MISMATCH'
              : null;
        scanStatus = unavailable ? 'SCANNER_UNAVAILABLE' : 'FAILED';
        safeErrorCode = unavailable
          ? (attemptCode ?? 'CLAMAV_UNAVAILABLE')
          : (attemptCode ?? fromClam ?? 'FILE_SCAN_FAILED');
      } else {
        safeErrorCode = attemptCode ?? 'FILE_NOT_CLEAN';
      }
    } else if (
      fileObjectStatus === FileObjectStatus.QUARANTINED ||
      fileObjectStatus === FileObjectStatus.SCANNING
    ) {
      scanStatus = 'SCANNING';
    }

    return {
      id: session.id,
      version: session.version,
      status: session.status,
      upload:
        options.includeUpload && options.presigned
          ? {
              method: 'PUT',
              url: options.presigned.url,
              headers: options.presigned.headers,
              expiresAt: options.presigned.expiresAt.toISOString(),
            }
          : null,
      scan: {
        status: scanStatus,
        safeErrorCode,
        fileObjectStatus,
      },
      fileObjectId: session.fileObjectId ?? null,
      allowedActions,
    };
  }
}
