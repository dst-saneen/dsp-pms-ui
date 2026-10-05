import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MalwareScanStatus, RecruitmentDocumentKind } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { basename, extname, join, resolve } from 'node:path';

import { Environment } from '../../../config';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../auth/redis.service';
import { RecruitmentObjectStorageService } from './recruitment-object-storage.service';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const FILE_SIGNATURES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'application/msword', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
];

export interface RecruitmentUploadInput {
  buffer: Buffer;
  originalFileName: string;
  declaredMimeType: string;
  kind: RecruitmentDocumentKind;
  candidateId?: string;
  jobApplicationId?: string;
  jobOfferId?: string;
  uploadedByUserId?: string;
  displayName?: string;
}

export interface StoredRecruitmentDocument {
  id: string;
  storageKey: string;
  checksumSha256: string;
  scanStatus: MalwareScanStatus;
}

interface DownloadTokenPayload {
  documentId: string;
  exp: number;
}

@Injectable()
export class RecruitmentDocumentService {
  private readonly logger = new Logger(RecruitmentDocumentService.name);
  private readonly downloadSecret: Buffer;
  private readonly downloadTtlSeconds: number;
  private readonly clamAvHost?: string;
  private readonly clamAvPort: number;
  private readonly nodeEnvironment: Environment['NODE_ENV'];
  private readonly memoryDownloadTokens = new Map<
    string,
    DownloadTokenPayload
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly storage: RecruitmentObjectStorageService,
    configService: ConfigService<Environment, true>,
  ) {
    this.downloadTtlSeconds = configService.getOrThrow(
      'RECRUITMENT_DOWNLOAD_TTL_SECONDS',
      { infer: true },
    );
    const secretPath = resolve(
      process.cwd(),
      configService.getOrThrow('AUTH_ACTION_TOKEN_SECRET_PATH', {
        infer: true,
      }),
    );
    this.downloadSecret =
      configService.getOrThrow('NODE_ENV', { infer: true }) === 'test' &&
      !existsSync(secretPath)
        ? Buffer.from('test-only-action-token-secret-value')
        : readFileSync(secretPath);
    this.nodeEnvironment = configService.getOrThrow('NODE_ENV', {
      infer: true,
    });
    this.clamAvHost = configService.get('CLAMAV_HOST', { infer: true });
    this.clamAvPort = configService.getOrThrow('CLAMAV_PORT', { infer: true });
  }

  validateUploadMetadata(
    originalFileName: string,
    declaredMimeType: string,
    fileSize: number,
  ): void {
    const extension = extname(originalFileName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOCUMENT_TYPE_INVALID',
        message: 'Only PDF, DOC, and DOCX files are allowed.',
      });
    }

    if (!ALLOWED_MIME_TYPES.has(declaredMimeType)) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOCUMENT_MIME_INVALID',
        message: 'Unsupported document MIME type.',
      });
    }

    if (fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOCUMENT_SIZE_INVALID',
        message: 'Document must be between 1 byte and 10 MB.',
      });
    }
  }

  validateFileSignature(buffer: Buffer, declaredMimeType: string): void {
    const signature = FILE_SIGNATURES.find((entry) => {
      if (entry.mime !== declaredMimeType) {
        return false;
      }

      return entry.bytes.every((byte, index) => buffer[index] === byte);
    });

    if (!signature) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOCUMENT_SIGNATURE_INVALID',
        message: 'Document content does not match the declared file type.',
      });
    }
  }

  async storeUpload(
    input: RecruitmentUploadInput,
  ): Promise<StoredRecruitmentDocument> {
    this.validateUploadMetadata(
      input.originalFileName,
      input.declaredMimeType,
      input.buffer.length,
    );
    this.validateFileSignature(input.buffer, input.declaredMimeType);

    const checksumSha256 = createHash('sha256')
      .update(input.buffer)
      .digest('hex');
    const storageKey = join(
      input.jobApplicationId ?? input.candidateId ?? 'unlinked',
      `${randomBytes(16).toString('hex')}${extname(input.originalFileName).toLowerCase()}`,
    );
    const stagedPath = this.storage.stageLocal(storageKey, input.buffer);

    let scanStatus: MalwareScanStatus;
    try {
      scanStatus = await this.scanFile(stagedPath);
    } catch (error) {
      this.storage.removeLocal(stagedPath);
      throw error;
    }

    if (
      scanStatus === MalwareScanStatus.INFECTED ||
      scanStatus === MalwareScanStatus.FAILED ||
      scanStatus === MalwareScanStatus.PENDING
    ) {
      const quarantineStorageKey = await this.storage.quarantineObject(
        storageKey,
        input.buffer,
      );
      this.storage.removeLocal(stagedPath);
      await this.prisma.recruitmentDocument.create({
        data: {
          candidateId: input.candidateId,
          jobApplicationId: input.jobApplicationId,
          jobOfferId: input.jobOfferId,
          kind: input.kind,
          originalFileName: basename(input.originalFileName),
          displayName:
            input.displayName?.trim() || basename(input.originalFileName),
          mimeType: input.declaredMimeType,
          fileSize: input.buffer.length,
          checksumSha256,
          storageKey: quarantineStorageKey,
          scanStatus:
            scanStatus === MalwareScanStatus.INFECTED
              ? MalwareScanStatus.QUARANTINED
              : scanStatus,
          scannedAt: new Date(),
          uploadedByUserId: input.uploadedByUserId,
        },
      });

      throw new BadRequestException({
        code:
          scanStatus === MalwareScanStatus.INFECTED
            ? 'RECRUITMENT_DOCUMENT_INFECTED'
            : 'RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE',
        message:
          scanStatus === MalwareScanStatus.INFECTED
            ? 'Document failed malware scanning.'
            : 'Document scanning is unavailable.',
      });
    }

    this.storage.removeLocal(stagedPath);
    const persistedStorageKey = await this.storage.putObject(
      storageKey,
      input.buffer,
    );

    const document = await this.prisma.recruitmentDocument.create({
      data: {
        candidateId: input.candidateId,
        jobApplicationId: input.jobApplicationId,
        jobOfferId: input.jobOfferId,
        kind: input.kind,
        originalFileName: basename(input.originalFileName),
        displayName:
          input.displayName?.trim() || basename(input.originalFileName),
        mimeType: input.declaredMimeType,
        fileSize: input.buffer.length,
        checksumSha256,
        storageKey: persistedStorageKey,
        scanStatus,
        scannedAt: new Date(),
        uploadedByUserId: input.uploadedByUserId,
      },
    });

    return {
      id: document.id,
      storageKey: document.storageKey,
      checksumSha256: document.checksumSha256,
      scanStatus: document.scanStatus,
    };
  }

  async storeGeneratedPdf(input: {
    buffer: Buffer;
    fileName: string;
    jobApplicationId: string;
    jobOfferId: string;
    uploadedByUserId?: string;
  }): Promise<StoredRecruitmentDocument> {
    return this.storeUpload({
      buffer: input.buffer,
      originalFileName: input.fileName,
      declaredMimeType: 'application/pdf',
      kind: RecruitmentDocumentKind.OFFER_PDF,
      jobApplicationId: input.jobApplicationId,
      jobOfferId: input.jobOfferId,
      uploadedByUserId: input.uploadedByUserId,
      displayName: input.fileName,
    });
  }

  async assertDocumentAvailable(documentId: string) {
    const document = await this.prisma.recruitmentDocument.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException({
        code: 'RECRUITMENT_DOCUMENT_NOT_FOUND',
        message: 'Document not found.',
      });
    }

    if (document.scanStatus !== MalwareScanStatus.CLEAN) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOCUMENT_UNAVAILABLE',
        message: 'Document is not available for download.',
      });
    }

    return document;
  }

  async createDownloadToken(documentId: string): Promise<string> {
    await this.assertDocumentAvailable(documentId);

    const exp = Date.now() + this.downloadTtlSeconds * 1_000;
    const payload: DownloadTokenPayload = { documentId, exp };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      'base64url',
    );
    const signature = createHmac('sha256', this.downloadSecret)
      .update(`recruitment-download:${encodedPayload}`)
      .digest('base64url');
    const token = `${encodedPayload}.${signature}`;

    await this.persistDownloadToken(token, payload);

    return token;
  }

  async resolveDownloadToken(token: string) {
    const [encodedPayload, signature] = token.split('.');

    if (!encodedPayload || !signature) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOWNLOAD_TOKEN_INVALID',
        message: 'Download token is invalid.',
      });
    }

    const expectedSignature = createHmac('sha256', this.downloadSecret)
      .update(`recruitment-download:${encodedPayload}`)
      .digest('base64url');

    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);

    if (
      provided.length !== expected.length ||
      !timingSafeEqual(provided, expected)
    ) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOWNLOAD_TOKEN_INVALID',
        message: 'Download token is invalid.',
      });
    }

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as DownloadTokenPayload;

    if (!payload.documentId || !payload.exp) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOWNLOAD_TOKEN_INVALID',
        message: 'Download token is invalid.',
      });
    }

    if (payload.exp <= Date.now()) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOWNLOAD_TOKEN_EXPIRED',
        message: 'Download token has expired.',
      });
    }

    const cached = await this.readDownloadToken(token);

    if (!cached || cached.documentId !== payload.documentId) {
      throw new BadRequestException({
        code: 'RECRUITMENT_DOWNLOAD_TOKEN_INVALID',
        message: 'Download token is invalid.',
      });
    }

    return payload.documentId;
  }

  async openDocumentStream(documentId: string) {
    const document = await this.assertDocumentAvailable(documentId);
    const stream = await this.storage.openObjectStream(document.storageKey);

    return {
      document,
      stream,
    };
  }

  private async scanFile(absolutePath: string): Promise<MalwareScanStatus> {
    if (!this.clamAvHost) {
      if (this.nodeEnvironment === 'production') {
        this.logger.error({
          event: 'recruitment.clamav.unconfigured',
          fallback: 'fail-closed',
        });
        throw new BadRequestException({
          code: 'RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE',
          message: 'Malware scanning is required and is not configured.',
        });
      }

      return MalwareScanStatus.CLEAN;
    }

    try {
      const infected = await this.scanWithClamAv(absolutePath);
      return infected ? MalwareScanStatus.INFECTED : MalwareScanStatus.CLEAN;
    } catch (error) {
      this.logger.warn({
        event: 'recruitment.clamav.failed',
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });

      if (this.nodeEnvironment === 'production') {
        throw new BadRequestException({
          code: 'RECRUITMENT_DOCUMENT_SCAN_UNAVAILABLE',
          message: 'Malware scanning failed.',
        });
      }

      return MalwareScanStatus.CLEAN;
    }
  }

  private scanWithClamAv(absolutePath: string): Promise<boolean> {
    return new Promise((resolvePromise, reject) => {
      const socket = createConnection(
        { host: this.clamAvHost, port: this.clamAvPort },
        () => {
          socket.write('zINSTREAM\0');
          const fileBuffer = readFileSync(absolutePath);
          const lengthBuffer = Buffer.alloc(4);
          lengthBuffer.writeUInt32BE(fileBuffer.length, 0);
          socket.write(lengthBuffer);
          socket.write(fileBuffer);
          socket.write(Buffer.alloc(4));
        },
      );

      let response = '';

      socket.on('data', (chunk) => {
        response += chunk.toString('utf8');
      });

      socket.on('error', reject);

      socket.on('end', () => {
        resolvePromise(response.includes('FOUND'));
      });
    });
  }

  private async persistDownloadToken(
    token: string,
    payload: DownloadTokenPayload,
  ): Promise<void> {
    const ttlSeconds = Math.max(
      1,
      Math.ceil((payload.exp - Date.now()) / 1_000),
    );
    const redisStored = await this.redisService.set(
      this.downloadRedisKey(token),
      JSON.stringify(payload),
      ttlSeconds,
    );

    if (redisStored === undefined) {
      this.memoryDownloadTokens.set(token, payload);
      setTimeout(() => {
        this.memoryDownloadTokens.delete(token);
      }, ttlSeconds * 1_000).unref?.();
    }
  }

  private async readDownloadToken(
    token: string,
  ): Promise<DownloadTokenPayload | undefined> {
    const redisValue = await this.redisService.get(
      this.downloadRedisKey(token),
    );

    if (redisValue) {
      return JSON.parse(redisValue) as DownloadTokenPayload;
    }

    return this.memoryDownloadTokens.get(token);
  }

  private downloadRedisKey(token: string): string {
    return `recruitment:download:${createHash('sha256').update(token).digest('hex')}`;
  }
}
