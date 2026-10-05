import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { S3StorageAdapter } from '../adapters/s3-storage.adapter';
import { FileAccessAuditService } from './file-access-audit.service';
import { FilenameEncryptionService } from './filename-encryption.service';
import { FileStorageFeatureService } from './file-storage-feature.service';
import { FileObjectStatus } from '@prisma/client';
import { getOrganizationScope } from '../../../common';

export interface DownloadGrantResult {
  url: string;
  expiresAt: string;
  fileName: string;
}

@Injectable()
export class FileDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: S3StorageAdapter,
    private readonly audit: FileAccessAuditService,
    private readonly filenameEncryption: FilenameEncryptionService,
    private readonly features: FileStorageFeatureService,
  ) {}

  async grantRecruitmentDocumentDownload(
    documentId: string,
    companyId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<DownloadGrantResult> {
    await this.features.assertStorageAvailable(companyId, null);
    const doc = await this.prisma.recruitmentDocument.findFirst({
      where: { id: documentId, companyId },
      include: { fileObject: true },
    });

    if (!doc) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = doc.fileObject;
    if (!fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    this.assertDocumentBranchScope(companyId, doc.branchId);

    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      doc.branchId ?? undefined,
      actorUserId,
      'RECRUITMENT_DOCUMENT_DOWNLOAD',
      requestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `document.${fileObject.safeExtension}`;

    // A previously clean record must not yield a fresh presigned URL after a
    // Company is disabled or File Storage is removed.
    await this.features.assertStorageAvailable(companyId, doc.branchId);

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'RecruitmentDocument',
      documentId: doc.id,
      companyId,
      branchId: doc.branchId,
      actorUserId,
      accessPurpose: 'RECRUITMENT_DOCUMENT_DOWNLOAD',
      decision: 'ALLOWED',
      requestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  async grantEmployeeDocumentDownload(
    documentId: string,
    companyId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<DownloadGrantResult> {
    await this.features.assertStorageAvailable(companyId, null);
    const doc = await this.prisma.employeeDocument.findFirst({
      where: { id: documentId, companyId },
      include: { fileObject: true },
    });

    if (!doc) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = doc.fileObject;
    if (!fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    this.assertDocumentBranchScope(companyId, doc.branchIdAtUpload);

    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      doc.branchIdAtUpload ?? undefined,
      actorUserId,
      'EMPLOYEE_DOCUMENT_DOWNLOAD',
      requestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `document.${fileObject.safeExtension}`;

    await this.features.assertStorageAvailable(companyId, doc.branchIdAtUpload);

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'EmployeeDocument',
      documentId: doc.id,
      companyId,
      branchId: doc.branchIdAtUpload,
      actorUserId,
      accessPurpose: 'EMPLOYEE_DOCUMENT_DOWNLOAD',
      decision: 'ALLOWED',
      requestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  async grantProjectDocumentDownload(
    documentId: string,
    companyId: string,
    projectId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<DownloadGrantResult> {
    await this.features.assertStorageAvailable(companyId, null);
    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, companyId, projectId },
      include: { fileObject: true },
    });

    if (!doc) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = doc.fileObject;
    if (!fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      undefined,
      actorUserId,
      'PROJECT_DOCUMENT_DOWNLOAD',
      requestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `document.${fileObject.safeExtension}`;

    // Recheck immediately before minting: an entitlement may have changed
    // while a clean file was being resolved.
    await this.features.assertStorageAvailable(companyId, null);

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'ProjectDocument',
      documentId: doc.id,
      companyId,
      actorUserId,
      accessPurpose: 'PROJECT_DOCUMENT_DOWNLOAD',
      decision: 'ALLOWED',
      requestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  async grantFinanceAttachmentDownload(
    attachmentId: string,
    companyId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<DownloadGrantResult> {
    await this.features.assertStorageAvailable(companyId, null);
    const attachment = await this.prisma.financeTransactionAttachment.findFirst(
      {
        where: { id: attachmentId, companyId },
        include: { fileObject: true },
      },
    );

    if (!attachment?.fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = attachment.fileObject;
    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      fileObject.branchId ?? undefined,
      actorUserId,
      'FINANCE_RECEIPT_DOWNLOAD',
      requestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `receipt.${fileObject.safeExtension}`;

    await this.features.assertStorageAvailable(companyId, fileObject.branchId);

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'FinanceTransactionAttachment',
      documentId: attachment.id,
      companyId,
      branchId: fileObject.branchId,
      actorUserId,
      accessPurpose: 'FINANCE_RECEIPT_DOWNLOAD',
      decision: 'ALLOWED',
      requestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  async grantPayslipDownload(
    payslipId: string,
    companyId: string,
    actorUserId: string,
    requestId?: string,
  ): Promise<DownloadGrantResult> {
    await this.features.assertStorageAvailable(companyId, null);
    const payslip = await this.prisma.payrollPayslip.findFirst({
      where: { id: payslipId, companyId },
      include: { fileObject: true },
    });

    if (!payslip?.fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = payslip.fileObject;
    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      fileObject.branchId ?? undefined,
      actorUserId,
      'PAYROLL_PAYSLIP_DOWNLOAD',
      requestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `payslip.${fileObject.safeExtension}`;

    await this.features.assertStorageAvailable(companyId, fileObject.branchId);

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'PayrollPayslip',
      documentId: payslip.id,
      companyId,
      branchId: fileObject.branchId,
      actorUserId,
      accessPurpose: 'PAYROLL_PAYSLIP_DOWNLOAD',
      decision: 'ALLOWED',
      requestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  async grantHrRequestAttachmentDownload(
    requestId: string,
    companyId: string,
    actorUserId: string,
    httpRequestId?: string,
  ): Promise<DownloadGrantResult> {
    const request = await this.prisma.hrRequest.findFirst({
      where: { id: requestId, companyId },
      include: { fileObject: true },
    });

    if (!request?.fileObjectId || !request.fileObject) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    const fileObject = request.fileObject;
    await this.assertClean(
      fileObject.status,
      fileObject.id,
      companyId,
      request.branchId ?? fileObject.branchId ?? undefined,
      actorUserId,
      'HR_REQUEST_ATTACHMENT_DOWNLOAD',
      httpRequestId,
    );

    const fileName =
      this.filenameEncryption.decrypt({
        ciphertext: fileObject.originalFileNameEncrypted,
        nonce: fileObject.fileNameEncNonce,
        tag: fileObject.fileNameEncTag,
        keyVersion: fileObject.fileNameEncKeyVersion,
      }) ?? `attachment.${fileObject.safeExtension}`;

    const grant = await this.storage.createPresignedGet(
      fileObject.objectKey,
      fileName,
    );

    await this.audit.record({
      fileObjectId: fileObject.id,
      documentType: 'HrRequest',
      documentId: request.id,
      companyId,
      branchId: request.branchId ?? fileObject.branchId,
      actorUserId,
      accessPurpose: 'HR_REQUEST_ATTACHMENT_DOWNLOAD',
      decision: 'ALLOWED',
      requestId: httpRequestId,
    });

    return {
      url: grant.url,
      expiresAt: grant.expiresAt.toISOString(),
      fileName,
    };
  }

  private async assertClean(
    status: FileObjectStatus,
    fileObjectId: string,
    companyId: string,
    branchId: string | undefined,
    actorUserId: string,
    purpose: string,
    requestId?: string,
  ) {
    const errorMap: Record<string, string> = {
      [FileObjectStatus.QUARANTINED]: 'FILE_SCAN_PENDING',
      [FileObjectStatus.SCANNING]: 'FILE_SCAN_PENDING',
      [FileObjectStatus.INFECTED]: 'FILE_INFECTED',
      [FileObjectStatus.SCAN_FAILED]: 'FILE_SCAN_FAILED',
      [FileObjectStatus.DELETION_PENDING]: 'FILE_NOT_CLEAN',
      [FileObjectStatus.DELETED]: 'FILE_NOT_FOUND',
      [FileObjectStatus.MISSING]: 'FILE_NOT_FOUND',
      [FileObjectStatus.UNREFERENCED]: 'FILE_NOT_CLEAN',
    };

    if (status !== FileObjectStatus.CLEAN) {
      const code = errorMap[status] ?? 'FILE_NOT_CLEAN';
      await this.audit.record({
        fileObjectId,
        companyId,
        branchId,
        actorUserId,
        accessPurpose: purpose,
        decision: 'DENIED',
        denialCode: code,
        requestId,
      });
      throw new ForbiddenException({ code });
    }
  }

  /**
   * Download endpoints receive a Company from the selected authenticated
   * context, but a branch-scoped role must still be unable to mint a URL for a
   * document from another branch in that Company. Return FILE_NOT_FOUND rather
   * than exposing cross-branch record existence.
   */
  private assertDocumentBranchScope(
    companyId: string,
    documentBranchId: string | null | undefined,
  ): void {
    const scope = getOrganizationScope();
    if (scope.isGlobal) {
      return;
    }

    if (!scope.activeCompanyId || scope.activeCompanyId !== companyId) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }

    if (
      scope.scopeLevel === 'BRANCH' &&
      (!scope.activeBranchId || documentBranchId !== scope.activeBranchId)
    ) {
      throw new NotFoundException({ code: 'FILE_NOT_FOUND' });
    }
  }
}
