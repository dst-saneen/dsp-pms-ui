import { Injectable } from '@nestjs/common';
import {
  FileDocumentMappingKind,
  FileObjectStatus,
  OfferSignatureSubmissionStatus,
  RecruitmentDocumentKind,
} from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { PrismaTx } from '../../outbox/outbox-writer.service';

@Injectable()
export class FileDocumentLinkingService {
  async assertMappingsConfigured(
    client:
      | PrismaTx
      | {
          recruitmentEmployeeDocumentMapping: PrismaTx['recruitmentEmployeeDocumentMapping'];
        },
    companyId: string,
    required: FileDocumentMappingKind[],
  ): Promise<void> {
    const mappings = await client.recruitmentEmployeeDocumentMapping.findMany({
      where: { companyId, mappingKind: { in: required } },
    });
    const found = new Set(mappings.map((row) => row.mappingKind));
    const missing = required.filter((kind) => !found.has(kind));
    if (missing.length > 0) {
      throw new DomainConflictException(
        'DOCUMENT_MAPPING_MISSING',
        'Recruitment to Employee document type mappings are not configured.',
      );
    }
  }

  async linkInConversionTransaction(
    tx: PrismaTx,
    input: {
      applicationId: string;
      employeeId: string;
      companyId: string;
      branchId: string;
    },
  ): Promise<void> {
    const application = await tx.jobApplication.findUnique({
      where: { id: input.applicationId },
      include: {
        documents: {
          where: { fileObjectId: { not: null } },
          include: { fileObject: true },
        },
        offers: {
          where: { status: 'ACCEPTED' },
          take: 1,
          include: {
            recruitmentDocument: { include: { fileObject: true } },
            signatureSubmissions: {
              where: { status: OfferSignatureSubmissionStatus.VERIFIED },
              take: 1,
              include: {
                recruitmentDocument: { include: { fileObject: true } },
                fileObject: true,
              },
            },
          },
        },
      },
    });

    if (!application) {
      throw new DomainConflictException(
        'APPLICATION_NOT_FOUND',
        'Application not found.',
      );
    }

    const required = new Set<FileDocumentMappingKind>();
    const cvDocs = application.documents.filter(
      (doc) => doc.kind === RecruitmentDocumentKind.CV && doc.fileObjectId,
    );
    const supportingDocs = application.documents.filter(
      (doc) =>
        doc.kind === RecruitmentDocumentKind.SUPPORTING && doc.fileObjectId,
    );
    const generatedOffer = application.offers[0]?.recruitmentDocument;
    const signed = application.offers[0]?.signatureSubmissions[0];

    if (cvDocs.length) required.add(FileDocumentMappingKind.CV);
    if (supportingDocs.length) required.add(FileDocumentMappingKind.SUPPORTING);
    if (generatedOffer?.fileObjectId) {
      required.add(FileDocumentMappingKind.GENERATED_OFFER);
    }
    if (signed) required.add(FileDocumentMappingKind.SIGNED_OFFER);

    await this.assertMappingsConfigured(tx, input.companyId, [...required]);

    const mappings = await tx.recruitmentEmployeeDocumentMapping.findMany({
      where: { companyId: input.companyId },
    });
    const typeByKind = new Map(
      mappings.map((row) => [row.mappingKind, row.employeeDocumentTypeId]),
    );

    const links: Array<{
      fileObjectId: string;
      documentTypeId: string;
      title: string;
      originalFileName: string;
      mimeType: string;
      fileSize: number;
    }> = [];

    for (const doc of [...cvDocs, ...supportingDocs]) {
      this.assertClean(doc.fileObject?.status);
      const kind =
        doc.kind === RecruitmentDocumentKind.CV
          ? FileDocumentMappingKind.CV
          : FileDocumentMappingKind.SUPPORTING;
      links.push({
        fileObjectId: doc.fileObjectId!,
        documentTypeId: typeByKind.get(kind)!,
        title: doc.displayName,
        originalFileName: doc.originalFileName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
      });
    }

    if (generatedOffer?.fileObjectId) {
      this.assertClean(generatedOffer.fileObject?.status);
      links.push({
        fileObjectId: generatedOffer.fileObjectId,
        documentTypeId: typeByKind.get(
          FileDocumentMappingKind.GENERATED_OFFER,
        )!,
        title: generatedOffer.displayName,
        originalFileName: generatedOffer.originalFileName,
        mimeType: generatedOffer.mimeType,
        fileSize: generatedOffer.fileSize,
      });
    }

    if (signed) {
      this.assertClean(signed.fileObject.status);
      links.push({
        fileObjectId: signed.fileObjectId,
        documentTypeId: typeByKind.get(FileDocumentMappingKind.SIGNED_OFFER)!,
        title: signed.recruitmentDocument.displayName,
        originalFileName: signed.recruitmentDocument.originalFileName,
        mimeType: signed.recruitmentDocument.mimeType,
        fileSize: signed.recruitmentDocument.fileSize,
      });
    }

    for (const link of links) {
      const existing = await tx.employeeDocument.findFirst({
        where: {
          employeeId: input.employeeId,
          fileObjectId: link.fileObjectId,
        },
      });
      if (existing) {
        continue;
      }
      await tx.employeeDocument.create({
        data: {
          employeeId: input.employeeId,
          companyId: input.companyId,
          branchIdAtUpload: input.branchId,
          documentTypeId: link.documentTypeId,
          fileObjectId: link.fileObjectId,
          title: link.title,
          originalFileName: link.originalFileName,
          mimeType: link.mimeType,
          fileSize: link.fileSize,
          verificationStatus: 'VERIFIED',
          version: 0,
        },
      });
      await tx.fileObject.update({
        where: { id: link.fileObjectId },
        data: { retentionClass: 'EMPLOYEE_RECORD' },
      });
    }
  }

  private assertClean(status?: FileObjectStatus | null) {
    if (status !== FileObjectStatus.CLEAN) {
      throw new DomainConflictException(
        'FILE_NOT_CLEAN',
        'A required recruitment file is not clean and cannot be converted.',
      );
    }
  }
}
