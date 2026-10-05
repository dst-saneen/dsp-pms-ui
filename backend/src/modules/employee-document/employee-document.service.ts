import { BadRequestException, Injectable } from '@nestjs/common';
import { FileObjectStatus, FileUploadPurpose, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestActor,
} from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { AuditService } from '../audit/audit.service';
import { FileUploadSessionService } from '../file-storage/services/file-upload-session.service';

import { CreateEmployeeDocumentDto } from './dto/create-employee-document.dto';
import { UpdateEmployeeDocumentDto } from './dto/update-employee-document.dto';
import { EmployeeDocumentQueryDto } from './dto/employee-document-query.dto';
import { VerifyEmployeeDocumentDto } from './dto/verify-employee-document.dto';
import { RejectEmployeeDocumentDto } from './dto/reject-employee-document.dto';
import {
  DocumentExpiryFilterDto,
  DocumentExpiryStatus,
} from './dto/document-expiry-filter.dto';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const DOCUMENT_INCLUDE = {
  employee: true,
  documentType: {
    include: {
      category: true,
    },
  },
  verifiedByUser: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  fileObject: {
    select: {
      id: true,
      status: true,
      detectedMimeType: true,
      actualSizeBytes: true,
      safeExtension: true,
      clamAvResult: true,
    },
  },
} satisfies Prisma.EmployeeDocumentInclude;

@Injectable()
export class EmployeeDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly uploadSessions: FileUploadSessionService,
  ) {}

  async create(dto: CreateEmployeeDocumentDto) {
    const employee = await this.scope.assertEmployeeInScope(dto.employeeId);

    const documentType = await this.prisma.employeeDocumentType.findFirst({
      where: {
        id: dto.documentTypeId,
        isActive: true,
        ...this.scope.documentTypeWhere(),
      },
    });

    if (!documentType) {
      throw new DomainNotFoundException(
        'DOCUMENT_TYPE_NOT_FOUND',
        'Document type not found',
      );
    }

    if (employee.companyId !== documentType.companyId) {
      throw new DomainNotFoundException(
        'DOCUMENT_TYPE_NOT_FOUND',
        'Document type not found',
      );
    }

    const lifetimeDocument = dto.lifetimeDocument ?? false;

    if (documentType.requiresDocumentNumber && !dto.documentNumber?.trim()) {
      throw new BadRequestException(
        'Document number is required for this document type',
      );
    }

    if (lifetimeDocument) {
      if (!documentType.lifetimeAllowed) {
        throw new BadRequestException(
          'Lifetime documents are not allowed for this document type',
        );
      }
    } else if (documentType.requiresExpiry && !dto.expiryDate) {
      throw new BadRequestException(
        'Expiry date is required for this document type',
      );
    }

    const issueDate = dto.issueDate ? new Date(dto.issueDate) : null;
    const expiryDate =
      lifetimeDocument || !dto.expiryDate ? null : new Date(dto.expiryDate);

    if (lifetimeDocument && dto.expiryDate) {
      throw new BadRequestException(
        'Lifetime documents must not include an expiry date',
      );
    }

    if (issueDate && expiryDate && issueDate > expiryDate) {
      throw new BadRequestException('Issue date cannot be after expiry date');
    }

    this.validateFileMetadata(dto.mimeType, dto.fileSize);

    const linkedFile = dto.uploadSessionId
      ? await this.uploadSessions.requireCleanSession({
          sessionId: dto.uploadSessionId,
          companyId: employee.companyId,
          purpose: FileUploadPurpose.EMPLOYEE_DOCUMENT,
          employeeId: employee.id,
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const document = await tx.employeeDocument.create({
        data: {
          employeeId: dto.employeeId,
          companyId: employee.companyId,
          branchIdAtUpload: employee.branchId,
          documentTypeId: dto.documentTypeId,
          title: dto.title.trim(),
          documentNumber: dto.documentNumber?.trim(),
          issueDate,
          expiryDate,
          lifetimeDocument,
          verificationStatus: 'PENDING',
          originalFileName:
            linkedFile?.expectedFileName ?? dto.originalFileName?.trim(),
          mimeType:
            linkedFile?.fileObject?.detectedMimeType ?? dto.mimeType?.trim(),
          fileSize: linkedFile?.fileObject?.actualSizeBytes ?? dto.fileSize,
          remarks: dto.remarks?.trim(),
          fileObjectId: linkedFile?.fileObjectId ?? null,
          version: 0,
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.auditService.log(
        'EmployeeDocument',
        document.id,
        'CREATE',
        null,
        this.auditSnapshot(document),
        { tx },
      );

      return document;
    });
  }

  async findAll(query: EmployeeDocumentQueryDto) {
    const where: Prisma.EmployeeDocumentWhereInput = {
      ...this.scope.documentWhere(),
      ...(query.employeeId && { employeeId: query.employeeId }),
      ...(query.documentTypeId && { documentTypeId: query.documentTypeId }),
      ...(query.verificationStatus && {
        verificationStatus: query.verificationStatus,
      }),
      ...(query.categoryId && {
        documentType: { categoryId: query.categoryId },
      }),
      ...(query.search && {
        OR: [
          {
            title: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
          {
            documentNumber: {
              contains: query.search,
              mode: 'insensitive',
            },
          },
        ],
      }),
    };

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const sortBy = query.sortBy ?? 'createdAt';
    const sortOrder = query.sortOrder ?? 'desc';

    return this.prisma.employeeDocument.findMany({
      where,
      include: DOCUMENT_INCLUDE,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  async findOne(id: string) {
    return this.findScopedDocument(id);
  }

  async findByEmployee(employeeId: string) {
    await this.scope.assertEmployeeInScope(employeeId);

    return this.prisma.employeeDocument.findMany({
      where: {
        employeeId,
        ...this.scope.documentWhere(),
      },
      include: DOCUMENT_INCLUDE,
      orderBy: {
        expiryDate: 'asc',
      },
    });
  }

  async getExpiredDocuments() {
    return this.prisma.employeeDocument.findMany({
      where: {
        ...this.scope.documentWhere(),
        expiryDate: {
          lt: new Date(),
        },
      },
      include: DOCUMENT_INCLUDE,
      orderBy: {
        expiryDate: 'asc',
      },
    });
  }

  async findByExpiry(filter: DocumentExpiryFilterDto) {
    const today = new Date();
    const future = new Date();
    future.setDate(future.getDate() + (filter.expiryWithinDays ?? 30));

    const where: Prisma.EmployeeDocumentWhereInput = {
      ...this.scope.documentWhere(),
      ...(filter.employeeId && { employeeId: filter.employeeId }),
      ...(filter.documentTypeId && { documentTypeId: filter.documentTypeId }),
    };

    switch (filter.expiryStatus) {
      case DocumentExpiryStatus.EXPIRED:
        where.expiryDate = { lt: today };
        break;
      case DocumentExpiryStatus.EXPIRING:
        where.expiryDate = { gte: today, lte: future };
        break;
      case DocumentExpiryStatus.LIFETIME:
        where.lifetimeDocument = true;
        break;
      case DocumentExpiryStatus.VALID:
        where.expiryDate = { gt: future };
        break;
    }

    return this.prisma.employeeDocument.findMany({
      where,
      include: DOCUMENT_INCLUDE,
      orderBy: {
        expiryDate: 'asc',
      },
    });
  }

  async getExpiringDocuments(days: number) {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.prisma.employeeDocument.findMany({
      where: {
        ...this.scope.documentWhere(),
        expiryDate: {
          gte: today,
          lte: futureDate,
        },
      },
      include: DOCUMENT_INCLUDE,
      orderBy: {
        expiryDate: 'asc',
      },
    });
  }

  async getEmployeeDocuments(employeeId: string) {
    const employee = await this.scope.assertEmployeeInScope(employeeId);

    const documents = await this.prisma.employeeDocument.findMany({
      where: {
        employeeId,
        ...this.scope.documentWhere(),
      },
      include: {
        documentType: {
          include: {
            category: true,
          },
        },
      },
      orderBy: {
        expiryDate: 'asc',
      },
    });

    return { employee, documents };
  }

  async summary() {
    const scopeWhere = this.scope.documentWhere();
    const today = new Date();

    const [total, verified, pending, expired, lifetime] = await Promise.all([
      this.prisma.employeeDocument.count({ where: scopeWhere }),
      this.prisma.employeeDocument.count({
        where: { ...scopeWhere, verificationStatus: 'VERIFIED' },
      }),
      this.prisma.employeeDocument.count({
        where: { ...scopeWhere, verificationStatus: 'PENDING' },
      }),
      this.prisma.employeeDocument.count({
        where: {
          ...scopeWhere,
          expiryDate: { lt: today },
        },
      }),
      this.prisma.employeeDocument.count({
        where: { ...scopeWhere, lifetimeDocument: true },
      }),
    ]);

    return { total, verified, pending, expired, lifetime };
  }

  async employeeSummary(employeeId: string) {
    await this.scope.assertEmployeeInScope(employeeId);

    const where: Prisma.EmployeeDocumentWhereInput = {
      employeeId,
      ...this.scope.documentWhere(),
    };
    const today = new Date();

    const [total, verified, pending, expired] = await Promise.all([
      this.prisma.employeeDocument.count({ where }),
      this.prisma.employeeDocument.count({
        where: { ...where, verificationStatus: 'VERIFIED' },
      }),
      this.prisma.employeeDocument.count({
        where: { ...where, verificationStatus: 'PENDING' },
      }),
      this.prisma.employeeDocument.count({
        where: {
          ...where,
          expiryDate: { lt: today },
        },
      }),
    ]);

    return { total, verified, pending, expired };
  }

  async verify(id: string, dto: VerifyEmployeeDocumentDto) {
    const document = await this.findScopedDocument(id);

    if (document.verificationStatus === 'VERIFIED') {
      return document;
    }

    if (document.verificationStatus !== 'PENDING') {
      throw new DomainConflictException(
        'DOCUMENT_NOT_PENDING',
        'Only pending documents can be verified',
      );
    }

    if (
      document.fileObjectId &&
      document.fileObject?.status !== FileObjectStatus.CLEAN
    ) {
      throw new DomainConflictException(
        'DOCUMENT_SCAN_NOT_CLEAN',
        'Only malware-clean files can be verified',
      );
    }

    const { userId } = getRequestActor();
    const verifiedDate = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeDocument.update({
        where: { id },
        data: {
          verificationStatus: 'VERIFIED',
          verifiedByUserId: userId ?? null,
          verifiedDate,
          ...(dto.remarks !== undefined && { remarks: dto.remarks.trim() }),
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.auditService.log(
        'EmployeeDocument',
        id,
        'VERIFY',
        this.auditSnapshot(document),
        this.auditSnapshot(updated),
        { tx },
      );

      return updated;
    });
  }

  async reject(id: string, dto: RejectEmployeeDocumentDto) {
    const document = await this.findScopedDocument(id);

    if (document.verificationStatus === 'REJECTED') {
      throw new DomainConflictException(
        'DOCUMENT_ALREADY_REJECTED',
        'Document is already rejected',
      );
    }

    if (document.verificationStatus === 'VERIFIED') {
      throw new DomainConflictException(
        'DOCUMENT_ALREADY_VERIFIED',
        'Verified documents must be reset before rejection',
      );
    }

    const { userId } = getRequestActor();
    const verifiedDate = new Date();

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeDocument.update({
        where: { id },
        data: {
          verificationStatus: 'REJECTED',
          verifiedByUserId: userId ?? null,
          verifiedDate,
          remarks: dto.remarks.trim(),
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.auditService.log(
        'EmployeeDocument',
        id,
        'REJECT',
        this.auditSnapshot(document),
        this.auditSnapshot(updated),
        { tx },
      );

      return updated;
    });
  }

  async resetVerification(id: string) {
    const document = await this.findScopedDocument(id);

    if (document.verificationStatus === 'PENDING') {
      throw new DomainConflictException(
        'DOCUMENT_ALREADY_PENDING',
        'Document is already pending verification',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeDocument.update({
        where: { id },
        data: {
          verificationStatus: 'PENDING',
          verifiedByUserId: null,
          verifiedDate: null,
          verifiedBy: null,
          remarks: null,
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.auditService.log(
        'EmployeeDocument',
        id,
        'RESET_VERIFICATION',
        this.auditSnapshot(document),
        this.auditSnapshot(updated),
        { tx },
      );

      return updated;
    });
  }

  async update(id: string, dto: UpdateEmployeeDocumentDto) {
    const document = await this.findScopedDocument(id);
    const employeeId = dto.employeeId ?? document.employeeId;
    const documentTypeId = dto.documentTypeId ?? document.documentTypeId;
    const employee = await this.scope.assertEmployeeInScope(employeeId);
    const documentType = await this.prisma.employeeDocumentType.findFirst({
      where: {
        id: documentTypeId,
        isActive: true,
        ...this.scope.documentTypeWhere(),
      },
    });

    if (!documentType || documentType.companyId !== employee.companyId) {
      throw new DomainNotFoundException(
        'DOCUMENT_TYPE_NOT_FOUND',
        'Document type not found',
      );
    }

    const lifetimeDocument = dto.lifetimeDocument ?? document.lifetimeDocument;
    const issueDate = dto.issueDate
      ? new Date(dto.issueDate)
      : document.issueDate;
    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : lifetimeDocument
        ? null
        : document.expiryDate;

    if (lifetimeDocument && dto.expiryDate) {
      throw new BadRequestException(
        'Lifetime documents must not include an expiry date',
      );
    }

    if (issueDate && expiryDate && issueDate > expiryDate) {
      throw new BadRequestException('Issue date cannot be after expiry date');
    }

    this.validateFileMetadata(dto.mimeType, dto.fileSize);

    const linkedFile = dto.uploadSessionId
      ? await this.uploadSessions.requireCleanSession({
          sessionId: dto.uploadSessionId,
          companyId: employee.companyId,
          purpose: FileUploadPurpose.EMPLOYEE_DOCUMENT,
          employeeId: employee.id,
        })
      : null;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.employeeDocument.update({
        where: { id },
        data: {
          employeeId,
          documentTypeId,
          ...(dto.title !== undefined && { title: dto.title.trim() }),
          ...(dto.documentNumber !== undefined && {
            documentNumber: dto.documentNumber?.trim(),
          }),
          ...(dto.issueDate !== undefined && { issueDate }),
          ...(dto.expiryDate !== undefined || dto.lifetimeDocument !== undefined
            ? { expiryDate }
            : {}),
          ...(dto.lifetimeDocument !== undefined && { lifetimeDocument }),
          ...(dto.originalFileName !== undefined && {
            originalFileName: dto.originalFileName?.trim(),
          }),
          ...(dto.mimeType !== undefined && { mimeType: dto.mimeType?.trim() }),
          ...(dto.fileSize !== undefined && { fileSize: dto.fileSize }),
          ...(dto.remarks !== undefined && { remarks: dto.remarks?.trim() }),
          ...(linkedFile
            ? {
                fileObjectId: linkedFile.fileObjectId,
                originalFileName: linkedFile.expectedFileName,
                mimeType: linkedFile.fileObject?.detectedMimeType,
                fileSize: linkedFile.fileObject?.actualSizeBytes,
                companyId: employee.companyId,
                branchIdAtUpload: employee.branchId,
              }
            : {}),
        },
        include: DOCUMENT_INCLUDE,
      });

      await this.auditService.log(
        'EmployeeDocument',
        id,
        'UPDATE',
        this.auditSnapshot(document),
        this.auditSnapshot(updated),
        { tx },
      );

      return updated;
    });
  }

  async remove(id: string) {
    const document = await this.findScopedDocument(id);

    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.employeeDocument.delete({
        where: { id },
      });

      await this.auditService.log(
        'EmployeeDocument',
        id,
        'DELETE',
        this.auditSnapshot(document),
        null,
        { tx },
      );

      return deleted;
    });
  }

  private async findScopedDocument(id: string) {
    const document = await this.prisma.employeeDocument.findFirst({
      where: {
        id,
        ...this.scope.documentWhere(),
      },
      include: DOCUMENT_INCLUDE,
    });

    if (!document) {
      throw new DomainNotFoundException(
        'DOCUMENT_NOT_FOUND',
        'Document not found',
      );
    }

    return document;
  }

  toSafeDocument(document: {
    storageProvider?: string | null;
    storageReference?: string | null;
    verificationStatus?: string;
    verifiedBy?: string | null;
    verifiedByUser?: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
    fileObject?: {
      status?: string | null;
      clamAvResult?: string | null;
    } | null;
    [key: string]: unknown;
  }) {
    const rest: Record<string, unknown> = { ...document };
    delete rest.storageProvider;
    delete rest.storageReference;
    delete rest.fileObject;
    delete rest.verifiedByUser;

    const fileStatus = document.fileObject?.status ?? null;
    const verificationStatus = document.verificationStatus ?? 'PENDING';
    const verifierName =
      document.verifiedByUser?.displayName?.trim() ||
      document.verifiedByUser?.username ||
      document.verifiedBy ||
      null;

    const allowedActions: string[] = [];
    if (fileStatus === FileObjectStatus.CLEAN) {
      allowedActions.push('DOWNLOAD');
    }
    if (verificationStatus === 'PENDING') {
      if (!document.fileObject || fileStatus === FileObjectStatus.CLEAN) {
        allowedActions.push('VERIFY');
      }
      allowedActions.push('REJECT');
    }
    if (
      verificationStatus === 'VERIFIED' ||
      verificationStatus === 'REJECTED'
    ) {
      allowedActions.push('RESET');
    }

    return {
      ...rest,
      fileStatus,
      scanDetail: document.fileObject?.clamAvResult ?? null,
      verifiedBy: verifierName,
      verifiedByUserId: document.verifiedByUser?.id ?? null,
      allowedActions,
    };
  }

  async getHistory(id: string) {
    await this.findScopedDocument(id);

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityName: 'EmployeeDocument',
        entityId: id,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const userIds = [
      ...new Set(
        logs
          .map((log) => log.userId)
          .filter((userId): userId is string => Boolean(userId)),
      ),
    ];

    const users =
      userIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, displayName: true },
          });

    const userById = new Map(users.map((user) => [user.id, user]));

    return logs.map((log) => {
      const actor = log.userId ? userById.get(log.userId) : null;
      return {
        id: log.id,
        action: log.action,
        createdAt: log.createdAt,
        actorUserId: log.userId,
        actorName:
          actor?.displayName?.trim() || actor?.username || log.userId || null,
        oldValue: log.oldValue,
        newValue: log.newValue,
      };
    });
  }

  private validateFileMetadata(mimeType?: string, fileSize?: number) {
    if (fileSize !== undefined && fileSize > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        'File size exceeds the maximum allowed limit of 25MB',
      );
    }

    if (
      mimeType &&
      ALLOWED_MIME_TYPES.size > 0 &&
      !ALLOWED_MIME_TYPES.has(mimeType.trim().toLowerCase())
    ) {
      throw new BadRequestException('Unsupported file type');
    }
  }

  private auditSnapshot(document: {
    id: string;
    employeeId: string;
    documentTypeId: string;
    verificationStatus: string;
    lifetimeDocument: boolean;
    expiryDate?: Date | null;
    remarks?: string | null;
  }) {
    return {
      id: document.id,
      employeeId: document.employeeId,
      documentTypeId: document.documentTypeId,
      verificationStatus: document.verificationStatus,
      lifetimeDocument: document.lifetimeDocument,
      expiryDate: document.expiryDate,
      remarks: document.remarks ?? null,
    };
  }
}
