import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface RecordAccessInput {
  fileObjectId: string;
  documentType?: string;
  documentId?: string;
  companyId: string;
  branchId?: string | null;
  actorUserId?: string;
  actorEmployeeId?: string;
  publicOfferContext?: string;
  accessPurpose: string;
  decision: 'ALLOWED' | 'DENIED';
  denialCode?: string;
  requestId?: string;
  correlationId?: string;
}

@Injectable()
export class FileAccessAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAccessInput): Promise<void> {
    await this.prisma.fileAccessAudit.create({
      data: {
        fileObjectId: input.fileObjectId,
        documentType: input.documentType ?? null,
        documentId: input.documentId ?? null,
        companyId: input.companyId,
        branchId: input.branchId ?? null,
        actorUserId: input.actorUserId ?? null,
        actorEmployeeId: input.actorEmployeeId ?? null,
        publicOfferContext: input.publicOfferContext ?? null,
        accessPurpose: input.accessPurpose,
        decision: input.decision,
        denialCode: input.denialCode ?? null,
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
  }
}
