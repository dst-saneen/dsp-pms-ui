import { Injectable } from '@nestjs/common';
import {
  FileObjectStatus,
  FileRetentionClass,
  FileUploadPurpose,
  FinanceActionEntityType,
} from '@prisma/client';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { DomainConflictException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { FileDownloadService } from '../../file-storage/services/file-download.service';
import { FileUploadSessionService } from '../../file-storage/services/file-upload-session.service';

import { OperationCommandDto } from '../dto/operation-command.dto';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FINANCE_PERMISSIONS } from '../policies/finance-permissions';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';

export class CreateFinanceUploadSessionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @MinLength(1)
  declaredMimeType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @Matches(/^[a-f0-9]{64}$/i)
  checksumSha256!: string;

  @IsString()
  @MinLength(1)
  operationId!: string;
}

export class LinkFinanceAttachmentDto extends OperationCommandDto {
  @IsUUID('4')
  uploadSessionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;
}

@Injectable()
export class OfficeFinanceAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: OfficeFinanceScopeService,
    private readonly receipts: FinanceCommandReceiptService,
    private readonly capabilities: FinanceCapabilityService,
    private readonly uploadSessions: FileUploadSessionService,
    private readonly downloads: FileDownloadService,
  ) {}

  async createUploadSession(
    transactionId: string,
    dto: CreateFinanceUploadSessionDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertAttachPermission(context);
    const companyId = this.scope.resolveCompanyId(context);
    const transaction = await this.loadAttachableTransaction(
      transactionId,
      companyId,
      context,
    );

    return this.uploadSessions.createSession({
      companyId,
      branchId: transaction.branchId,
      purpose: FileUploadPurpose.FINANCE_RECEIPT,
      applicationOperationId: transactionId,
      fileName: dto.fileName,
      declaredMimeType: dto.declaredMimeType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256,
      operationId: dto.operationId,
      creatorUserId: context.userId,
    });
  }

  async finalizeUploadSession(
    transactionId: string,
    sessionId: string,
    sessionToken: string | undefined,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertAttachPermission(context);
    const companyId = this.scope.resolveCompanyId(context);
    const transaction = await this.loadAttachableTransaction(
      transactionId,
      companyId,
      context,
    );
    await this.assertUploadSessionBelongsToTransaction(
      sessionId,
      transactionId,
      companyId,
      transaction.branchId,
    );

    return this.uploadSessions.finalizeSession(
      sessionId,
      companyId,
      context.userId,
      sessionToken,
    );
  }

  async getUploadSession(
    transactionId: string,
    sessionId: string,
    sessionToken: string | undefined,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertReadPermission(context);
    const companyId = this.scope.resolveCompanyId(context);
    const transaction = await this.loadVisibleTransaction(
      transactionId,
      companyId,
      context,
    );
    await this.assertUploadSessionBelongsToTransaction(
      sessionId,
      transactionId,
      companyId,
      transaction.branchId,
    );

    return this.uploadSessions.getSession(
      sessionId,
      companyId,
      context.userId,
      sessionToken,
    );
  }

  async linkAttachment(
    transactionId: string,
    dto: LinkFinanceAttachmentDto,
    context: OfficeFinanceAccessContext,
  ) {
    this.assertAttachPermission(context);
    const companyId = this.scope.resolveCompanyId(context);

    // Keep the feature and tenant assertion outside the receipt transaction so
    // a direct service caller cannot turn a Company-only check into a bypass.
    await this.loadAttachableTransaction(transactionId, companyId, context);

    return this.receipts.execute(
      context,
      companyId,
      'LINK_FINANCE_ATTACHMENT',
      { transactionId, ...dto },
      async (tx) => {
        const transaction = await tx.financeTransaction.findFirst({
          where: {
            id: transactionId,
            ...this.scope.financeTransactionWhere(companyId, context),
          },
        });
        if (!transaction) {
          this.scope.notFound('Finance transaction');
        }

        const allowed = this.capabilities.getTransactionAllowedActions(
          transaction,
          context,
        );
        if (!allowed.includes('ATTACH_DOCUMENT')) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
            'Attachments cannot be linked in the current transaction state.',
          );
        }

        const session = await this.uploadSessions.requireCleanSession({
          sessionId: dto.uploadSessionId,
          companyId,
          purpose: FileUploadPurpose.FINANCE_RECEIPT,
        });

        if (
          session.applicationOperationId !== transactionId ||
          session.branchId !== transaction.branchId
        ) {
          this.scope.notFound('Upload session');
        }

        const fileObject = session.fileObject;
        if (
          !fileObject ||
          fileObject.status !== FileObjectStatus.CLEAN ||
          fileObject.companyId !== companyId
        ) {
          throw new DomainConflictException(
            FINANCE_ERROR_CODES.FINANCE_ATTACHMENT_NOT_CLEAN,
            'Only clean same-Company Finance receipt files can be linked.',
          );
        }

        await tx.fileObject.update({
          where: { id: fileObject.id },
          data: { retentionClass: FileRetentionClass.FINANCE_RECORD },
        });

        const attachment = await tx.financeTransactionAttachment.create({
          data: {
            companyId,
            financeTransactionId: transactionId,
            fileObjectId: fileObject.id,
            title: dto.title?.trim() || null,
            linkedByUserId: context.userId,
            linkedAt: new Date(),
          },
        });

        await tx.financeActionEvent.create({
          data: {
            companyId,
            entityType: FinanceActionEntityType.ATTACHMENT,
            entityId: attachment.id,
            action: 'LINK',
            actorUserId: context.userId,
            operationId: dto.operationId,
            versionBefore: transaction.version,
            versionAfter: transaction.version,
          },
        });

        return this.receipts.commandMeta('FINANCE_ATTACHMENT', attachment.id);
      },
      async (attachmentId) => {
        const transaction = await this.loadVisibleTransaction(
          transactionId,
          companyId,
          context,
        );
        const attachment =
          await this.prisma.financeTransactionAttachment.findFirst({
            where: {
              id: attachmentId,
              companyId,
              financeTransactionId: transaction.id,
            },
          });
        if (!attachment) {
          this.scope.notFound('Finance attachment');
        }
        return {
          id: attachment.id,
          financeTransactionId: attachment.financeTransactionId,
          fileObjectId: attachment.fileObjectId,
          title: attachment.title,
          linkedAt: attachment.linkedAt.toISOString(),
        };
      },
    );
  }

  async createDownloadGrant(
    transactionId: string,
    attachmentId: string,
    context: OfficeFinanceAccessContext,
    requestId?: string,
  ) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_READ) &&
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE) &&
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'Missing finance transaction permission.',
      );
    }

    const companyId = this.scope.resolveCompanyId(context);
    const transaction = await this.loadVisibleTransaction(
      transactionId,
      companyId,
      context,
    );

    const attachment = await this.prisma.financeTransactionAttachment.findFirst(
      {
        where: {
          id: attachmentId,
          companyId,
          financeTransactionId: transaction.id,
        },
      },
    );

    if (!attachment) {
      this.scope.notFound('Finance attachment');
    }

    return this.downloads.grantFinanceAttachmentDownload(
      attachmentId,
      companyId,
      context.userId,
      requestId,
    );
  }

  async listAttachments(
    transactionId: string,
    context: OfficeFinanceAccessContext,
  ) {
    const companyId = this.scope.resolveCompanyId(context);
    const transaction = await this.loadVisibleTransaction(
      transactionId,
      companyId,
      context,
    );

    const rows = await this.prisma.financeTransactionAttachment.findMany({
      where: { financeTransactionId: transaction.id, companyId },
      orderBy: { linkedAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      fileObjectId: row.fileObjectId,
      title: row.title,
      linkedAt: row.linkedAt.toISOString(),
    }));
  }

  private async loadVisibleTransaction(
    transactionId: string,
    companyId: string,
    context: OfficeFinanceAccessContext,
  ) {
    await this.scope.assertCompanyScope(companyId);
    const transaction = await this.prisma.financeTransaction.findFirst({
      where: {
        id: transactionId,
        ...this.scope.financeTransactionWhere(companyId, context),
      },
    });
    if (!transaction) {
      this.scope.notFound('Finance transaction');
    }

    return transaction;
  }

  private async assertUploadSessionBelongsToTransaction(
    sessionId: string,
    transactionId: string,
    companyId: string,
    branchId: string | null,
  ) {
    const session = await this.prisma.fileUploadSession.findFirst({
      where: {
        id: sessionId,
        companyId,
        branchId,
        purpose: FileUploadPurpose.FINANCE_RECEIPT,
        applicationOperationId: transactionId,
      },
      select: { id: true },
    });

    if (!session) {
      this.scope.notFound('Upload session');
    }
  }

  private async loadAttachableTransaction(
    transactionId: string,
    companyId: string,
    context: OfficeFinanceAccessContext,
  ) {
    const transaction = await this.loadVisibleTransaction(
      transactionId,
      companyId,
      context,
    );

    const allowed = this.capabilities.getTransactionAllowedActions(
      transaction,
      context,
    );
    if (!allowed.includes('ATTACH_DOCUMENT')) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.FINANCE_TRANSACTION_STATE_CHANGED,
        'Attachments cannot be uploaded in the current transaction state.',
      );
    }

    return transaction;
  }

  private assertAttachPermission(context: OfficeFinanceAccessContext) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE) &&
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'Missing finance attachment permission.',
      );
    }
  }

  private assertReadPermission(context: OfficeFinanceAccessContext) {
    if (
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_READ) &&
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_MANAGE) &&
      !context.permissions.includes(FINANCE_PERMISSIONS.TRANSACTIONS_APPROVE)
    ) {
      throw new DomainConflictException(
        FINANCE_ERROR_CODES.VALIDATION_ERROR,
        'Missing finance transaction permission.',
      );
    }
  }
}
