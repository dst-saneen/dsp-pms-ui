import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FileUploadPurpose, Prisma } from '@prisma/client';

import { WorkforceWorkflowCode } from '../../common/constants/workforce-time-contracts';
import { inclusiveUpperDateFilter } from '../../common/helpers/query-date-bound.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';
import { FileUploadSessionService } from '../file-storage/services/file-upload-session.service';
import { FileDownloadService } from '../file-storage/services/file-download.service';
import { FilenameEncryptionService } from '../file-storage/services/filename-encryption.service';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import { WorkforceApprovalResolverService } from '../workforce-approval/workforce-approval-resolver.service';

import { CreateHrRequestDto } from './dto/create-hr-request.dto';
import { CreateHrRequestUploadSessionDto } from './dto/create-hr-request-upload-session.dto';
import {
  HrRequestReasonCommandDto,
  HrRequestVersionedCommandDto,
  RejectHrRequestDto,
} from './dto/hr-request-command.dto';
import { ListHrRequestsDto } from './dto/list-hr-requests.dto';
import { ListPendingHrApprovalsDto } from './dto/list-pending-hr-approvals.dto';

const requestInclude = {
  employee: {
    select: {
      id: true,
      companyId: true,
      branchId: true,
      departmentId: true,
      managerId: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      branch: {
        select: { id: true, branchCode: true, branchName: true },
      },
      department: {
        select: { id: true, departmentCode: true, departmentName: true },
      },
      designation: {
        select: { id: true, designationCode: true, designationName: true },
      },
      company: { select: { companyGroupId: true } },
    },
  },
  branch: {
    select: { id: true, branchCode: true, branchName: true },
  },
  requestType: { select: { id: true, requestCode: true, requestName: true } },
  approvalTransaction: {
    include: {
      approvalSteps: {
        orderBy: { stepNo: 'asc' as const },
        include: {
          approver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
            },
          },
        },
      },
    },
  },
  fileObject: {
    select: {
      id: true,
      status: true,
      branchId: true,
      safeExtension: true,
      originalFileNameEncrypted: true,
      fileNameEncNonce: true,
      fileNameEncTag: true,
      fileNameEncKeyVersion: true,
    },
  },
} satisfies Prisma.HrRequestInclude;

type RequestDetail = Prisma.HrRequestGetPayload<{
  include: typeof requestInclude;
}>;

@Injectable()
export class HrRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly approvals: WorkforceApprovalResolverService,
    private readonly fileUploads: FileUploadSessionService,
    private readonly downloads: FileDownloadService,
    private readonly filenameEncryption: FilenameEncryptionService,
    private readonly receipts: HrOperationsCommandReceiptService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async create(dto: CreateHrRequestDto, actor: AuthenticatedUser) {
    const employee = await this.assertActorEmployee(actor);
    const requestType = await this.prisma.hrRequestType.findFirst({
      where: {
        id: dto.requestTypeId,
        companyId: employee.companyId,
        isActive: true,
      },
      select: {
        id: true,
        requiresApproval: true,
        workflowId: true,
      },
    });
    if (!requestType) {
      throw new NotFoundException({ code: 'HR_REQUEST_TYPE_NOT_FOUND' });
    }

    return this.receipts.execute({
      companyId: employee.companyId,
      actorUserId: actor.id,
      commandType: 'CREATE_HR_REQUEST',
      operationId: dto.operationId,
      stateChangedCode: 'HR_REQUEST_STATE_CHANGED',
      requestPayload: {
        requestTypeId: dto.requestTypeId,
        remarks: dto.remarks?.trim() || null,
        attachmentUploadSessionId: dto.attachmentUploadSessionId ?? null,
      },
      execute: async (tx) => {
        const attachment = dto.attachmentUploadSessionId
          ? await this.fileUploads.requireCleanSession({
              sessionId: dto.attachmentUploadSessionId,
              companyId: employee.companyId,
              purpose: FileUploadPurpose.HR_REQUEST_ATTACHMENT,
              employeeId: employee.id,
              actorUserId: actor.id,
            })
          : null;
        if (dto.attachmentUploadSessionId && !attachment?.fileObjectId) {
          throw new NotFoundException({ code: 'HR_REQUEST_FILE_NOT_FOUND' });
        }

        let workflowId: string | null = null;
        let workflowSteps: Array<{
          stepNo: number;
          approverType: string;
          approverRole: string | null;
        }> = [];
        let firstApproverEmployeeId: string | null = null;
        if (requestType.requiresApproval) {
          const workflow = requestType.workflowId
            ? await tx.approvalWorkflow.findFirst({
                where: {
                  id: requestType.workflowId,
                  isActive: true,
                  OR: [{ companyId: employee.companyId }, { companyId: null }],
                },
                include: { steps: { orderBy: { stepNo: 'asc' } } },
              })
            : await this.approvals.resolveWorkflow(
                {
                  workflowCode: WorkforceWorkflowCode.HR_REQUEST,
                  companyId: employee.companyId,
                },
                tx,
              );
          if (!workflow || workflow.steps.length === 0) {
            throw new ConflictException({
              code: 'HR_REQUEST_WORKFLOW_NOT_CONFIGURED',
              message:
                'An active HR Request workflow with at least one step is required',
            });
          }
          workflowId = workflow.id;
          workflowSteps = workflow.steps;
        }

        const request = await tx.hrRequest.create({
          data: {
            requestNo: `HRR-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 8)
              .toUpperCase()}`,
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId: employee.id,
            requestTypeId: requestType.id,
            remarks: dto.remarks?.trim() || null,
            fileObjectId: attachment?.fileObjectId ?? null,
            createdByUserId: actor.id,
            status: requestType.requiresApproval
              ? 'PENDING_APPROVAL'
              : 'APPROVED',
            ...(requestType.requiresApproval
              ? {}
              : { approvedByUserId: actor.id, approvedAt: new Date() }),
          },
        });

        if (workflowId) {
          const transaction = await tx.approvalTransaction.create({
            data: {
              workflowId,
              entityType: 'HR_REQUEST',
              entityId: request.id,
              requestedById: employee.id,
              status: 'PENDING',
            },
          });
          for (const step of workflowSteps) {
            const approverId = await this.approvals.resolveApproverEmployeeId(
              {
                companyId: employee.companyId,
                branchId: employee.branchId,
                companyGroupId: employee.company.companyGroupId,
                subjectEmployeeId: employee.id,
                managerId: employee.managerId,
                step,
              },
              tx,
            );
            if (!approverId || approverId === employee.id) {
              const stepLabel =
                step.approverType === 'ROLE' && step.approverRole
                  ? `role ${step.approverRole}`
                  : step.approverType === 'REPORTING_MANAGER'
                    ? 'reporting manager'
                    : step.approverType;
              throw new ConflictException({
                code: 'HR_REQUEST_APPROVER_NOT_AVAILABLE',
                message: `No eligible approver for ${stepLabel}. Submit as Employee (Jamie), then Manager (Alex) Approves, then HR Completes. Do not use an HR-only path where you would approve your own request.`,
              });
            }
            firstApproverEmployeeId ??= approverId;
            await tx.approvalTransactionStep.create({
              data: {
                transactionId: transaction.id,
                stepNo: step.stepNo,
                approverId,
              },
            });
          }
          await tx.hrRequest.update({
            where: { id: request.id },
            data: { approvalTransactionId: transaction.id },
          });
        }

        const detailed = await tx.hrRequest.findUniqueOrThrow({
          where: { id: request.id },
          include: requestInclude,
        });
        await this.audit.log(
          'HrRequest',
          request.id,
          'CREATE',
          null,
          { status: detailed.status, requestTypeId: detailed.requestTypeId },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          detailed,
          'HR_REQUEST_CREATED',
          [actor.id],
          'created',
        );
        if (firstApproverEmployeeId) {
          const approverUserIds = await this.resolveActiveUserIdsForEmployees(
            tx,
            [firstApproverEmployeeId],
          );
          await this.writeEvent(
            tx,
            detailed,
            'HR_REQUEST_APPROVAL_REQUIRED',
            approverUserIds,
            'approval-required',
          );
        }
        const result = this.decorate(detailed, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  async createUploadSession(
    dto: CreateHrRequestUploadSessionDto,
    actor: AuthenticatedUser,
  ) {
    const employee = await this.assertActorEmployee(actor);
    return this.fileUploads.createSession({
      companyId: employee.companyId,
      branchId: employee.branchId,
      purpose: FileUploadPurpose.HR_REQUEST_ATTACHMENT,
      employeeId: employee.id,
      fileName: dto.fileName,
      declaredMimeType: dto.declaredMimeType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256,
      operationId: dto.operationId,
      creatorUserId: actor.id,
    });
  }

  async findAll(query: ListHrRequestsDto, actor: AuthenticatedUser) {
    const activeActorEmployee = await this.findActiveActorEmployee(actor);
    const canReadAll = this.canReadAll(actor);
    const where: Prisma.HrRequestWhereInput = {
      ...this.scope.hrRequestWhere(),
      ...(canReadAll
        ? {}
        : { employeeId: actor.employeeId ?? '__no_employee__' }),
      ...(query.employeeId && canReadAll
        ? { employeeId: query.employeeId }
        : {}),
      ...(query.status ? { status: query.status.trim().toUpperCase() } : {}),
      ...(query.keyword
        ? {
            OR: [
              {
                requestNo: {
                  contains: query.keyword.trim(),
                  mode: 'insensitive',
                },
              },
              {
                remarks: {
                  contains: query.keyword.trim(),
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.hrRequest.findMany({
        where,
        include: requestInclude,
        orderBy: {
          [query.sortBy ?? 'createdAt']: query.sortOrder ?? 'desc',
        },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.hrRequest.count({ where }),
    ]);
    return {
      items: items.map((row) => this.decorate(row, actor)),
      total,
      page: query.page,
      limit: query.limit,
      allowedActions: activeActorEmployee ? ['CREATE'] : [],
    };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const request = await this.prisma.hrRequest.findFirst({
      where: {
        id,
        ...this.scope.hrRequestWhere(),
        ...(this.canReadAll(actor)
          ? {}
          : { employeeId: actor.employeeId ?? '__no_employee__' }),
      },
      include: requestInclude,
    });
    if (!request) throw new NotFoundException({ code: 'HR_REQUEST_NOT_FOUND' });
    return this.decorate(request, actor);
  }

  async createAttachmentDownloadGrant(
    id: string,
    actor: AuthenticatedUser,
    requestId?: string,
  ) {
    const request = await this.prisma.hrRequest.findFirst({
      where: {
        id,
        ...this.scope.hrRequestWhere(),
      },
      include: requestInclude,
    });
    if (!request) throw new NotFoundException({ code: 'HR_REQUEST_NOT_FOUND' });

    const canView =
      this.canReadAll(actor) ||
      actor.employeeId === request.employeeId ||
      this.isPendingApprover(request, actor);
    if (!canView) throw new ForbiddenException();
    if (!request.fileObjectId) {
      throw new NotFoundException({ code: 'HR_REQUEST_FILE_NOT_FOUND' });
    }

    return this.downloads.grantHrRequestAttachmentDownload(
      request.id,
      request.companyId,
      actor.id,
      requestId,
    );
  }

  async pendingApprovals(
    actor: AuthenticatedUser,
    query: ListPendingHrApprovalsDto = new ListPendingHrApprovalsDto(),
  ) {
    const paginationRequested =
      query.page !== undefined || query.limit !== undefined;
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    if (!actor.employeeId) return { items: [], total: 0, page, limit };
    const transactionIds = await this.findCurrentApproverTransactionIds(actor);
    if (transactionIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    const keyword = query.keyword?.trim();
    const filterWhere: Prisma.HrRequestWhereInput = {
      ...(query.branchId ? { branchId: query.branchId } : {}),
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.requestTypeId ? { requestTypeId: query.requestTypeId } : {}),
      ...(query.submittedFrom || query.submittedTo
        ? {
            createdAt: {
              ...(query.submittedFrom
                ? { gte: new Date(query.submittedFrom) }
                : {}),
              ...(query.submittedTo
                ? inclusiveUpperDateFilter(query.submittedTo)
                : {}),
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { requestNo: { contains: keyword, mode: 'insensitive' } },
              { remarks: { contains: keyword, mode: 'insensitive' } },
              {
                employee: {
                  employeeCode: { contains: keyword, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  firstName: { contains: keyword, mode: 'insensitive' },
                },
              },
              {
                employee: {
                  lastName: { contains: keyword, mode: 'insensitive' },
                },
              },
              {
                requestType: {
                  requestCode: { contains: keyword, mode: 'insensitive' },
                },
              },
              {
                requestType: {
                  requestName: { contains: keyword, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    const where: Prisma.HrRequestWhereInput = {
      AND: [
        this.scope.hrRequestWhere(),
        {
          status: 'PENDING_APPROVAL',
          employeeId: { not: actor.employeeId },
          approvalTransactionId: { in: transactionIds },
        },
        filterWhere,
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.hrRequest.findMany({
        where,
        include: requestInclude,
        orderBy: { createdAt: 'asc' },
        ...(paginationRequested
          ? { skip: (page - 1) * limit, take: limit }
          : {}),
      }),
      this.prisma.hrRequest.count({ where }),
    ]);
    const items = rows.map((row) => this.decorate(row, actor));
    return {
      items,
      total,
      page,
      limit,
    };
  }

  async approve(
    id: string,
    dto: HrRequestVersionedCommandDto,
    actor: AuthenticatedUser,
  ) {
    return this.decide(id, dto, actor, 'APPROVE');
  }

  async reject(id: string, dto: RejectHrRequestDto, actor: AuthenticatedUser) {
    if (!dto.reason?.trim() || dto.reason.trim().length < 3) {
      throw new BadRequestException({ code: 'REJECTION_REASON_REQUIRED' });
    }
    return this.decide(id, dto, actor, 'REJECT');
  }

  async complete(
    id: string,
    dto: HrRequestVersionedCommandDto,
    actor: AuthenticatedUser,
  ) {
    if (!this.canManage(actor)) throw new ForbiddenException();
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: 'COMPLETE_HR_REQUEST',
      operationId: dto.operationId,
      stateChangedCode: 'HR_REQUEST_STATE_CHANGED',
      requestPayload: { id, expectedVersion: dto.expectedVersion },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        this.assertVersion(current.version, dto.expectedVersion);
        if (current.status !== 'APPROVED') {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        const transitioned = await tx.hrRequest.updateMany({
          where: { id, version: dto.expectedVersion, status: 'APPROVED' },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            completedByUserId: actor.id,
            version: { increment: 1 },
          },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        const updated = await tx.hrRequest.findUniqueOrThrow({
          where: { id },
          include: requestInclude,
        });
        await this.audit.log(
          'HrRequest',
          id,
          'COMPLETE',
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          updated,
          'HR_REQUEST_COMPLETED',
          [updated.createdByUserId],
          'completed',
        );
        const result = this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  async cancel(
    id: string,
    dto: HrRequestReasonCommandDto,
    actor: AuthenticatedUser,
  ) {
    const cancellationReason = dto.reason?.trim();
    if (!cancellationReason || cancellationReason.length < 3) {
      throw new BadRequestException({
        code: 'HR_REQUEST_CANCELLATION_REASON_REQUIRED',
      });
    }
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: 'CANCEL_HR_REQUEST',
      operationId: dto.operationId,
      stateChangedCode: 'HR_REQUEST_STATE_CHANGED',
      requestPayload: {
        id,
        expectedVersion: dto.expectedVersion,
        reason: cancellationReason,
      },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        const isOwner = actor.employeeId === current.employeeId;
        if (!isOwner && !this.canManage(actor)) throw new ForbiddenException();
        this.assertVersion(current.version, dto.expectedVersion);
        if (!['PENDING_APPROVAL', 'APPROVED'].includes(current.status)) {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        if (current.status === 'APPROVED' && !this.canManage(actor)) {
          throw new ForbiddenException();
        }
        const transitioned = await tx.hrRequest.updateMany({
          where: {
            id,
            version: dto.expectedVersion,
            status: { in: ['PENDING_APPROVAL', 'APPROVED'] },
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledByUserId: actor.id,
            cancellationReason,
            version: { increment: 1 },
          },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        const updated = await tx.hrRequest.findUniqueOrThrow({
          where: { id },
          include: requestInclude,
        });
        if (current.approvalTransactionId) {
          await tx.approvalTransaction.update({
            where: { id: current.approvalTransactionId },
            data: { status: 'CANCELLED' },
          });
        }
        await this.audit.log(
          'HrRequest',
          id,
          'CANCEL',
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          updated,
          'HR_REQUEST_CANCELLED',
          [updated.createdByUserId],
          'cancelled',
        );
        const result = this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  private async decide(
    id: string,
    dto: HrRequestVersionedCommandDto & { reason?: string },
    actor: AuthenticatedUser,
    action: 'APPROVE' | 'REJECT',
  ) {
    if (!actor.employeeId) throw new ForbiddenException();
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: `${action}_HR_REQUEST`,
      operationId: dto.operationId,
      stateChangedCode: 'HR_REQUEST_STATE_CHANGED',
      requestPayload: {
        id,
        expectedVersion: dto.expectedVersion,
        reason: dto.reason?.trim() || null,
      },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        this.assertVersion(current.version, dto.expectedVersion);
        if (
          current.status !== 'PENDING_APPROVAL' ||
          !current.approvalTransaction
        ) {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        if (current.employeeId === actor.employeeId) {
          throw new ForbiddenException({
            code: 'HR_REQUEST_SELF_APPROVAL_FORBIDDEN',
          });
        }
        const transaction = current.approvalTransaction;
        const step = transaction.approvalSteps.find(
          (row) => row.stepNo === transaction.currentStep,
        );
        if (
          !step ||
          step.status !== 'PENDING' ||
          step.approverId !== actor.employeeId
        ) {
          throw new ForbiddenException({
            code: 'HR_REQUEST_APPROVER_NOT_ELIGIBLE',
          });
        }
        const now = new Date();
        await tx.approvalTransactionStep.update({
          where: { id: step.id },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            remarks: dto.reason?.trim() || null,
            actionDate: now,
          },
        });
        let nextApproverId: string | null = null;
        let requestUpdate: Prisma.HrRequestUncheckedUpdateManyInput;
        if (action === 'REJECT') {
          await tx.approvalTransaction.update({
            where: { id: transaction.id },
            data: { status: 'REJECTED' },
          });
          requestUpdate = {
            status: 'REJECTED',
            rejectedAt: now,
            rejectedByUserId: actor.id,
            version: { increment: 1 },
          };
        } else {
          const next = transaction.approvalSteps.find(
            (row) =>
              row.stepNo > transaction.currentStep && row.status === 'PENDING',
          );
          if (next) {
            nextApproverId = next.approverId;
            await tx.approvalTransaction.update({
              where: { id: transaction.id },
              data: { currentStep: next.stepNo },
            });
            requestUpdate = { version: { increment: 1 } };
          } else {
            await tx.approvalTransaction.update({
              where: { id: transaction.id },
              data: { status: 'APPROVED' },
            });
            requestUpdate = {
              status: 'APPROVED',
              approvedAt: now,
              approvedByUserId: actor.id,
              version: { increment: 1 },
            };
          }
        }
        const transitioned = await tx.hrRequest.updateMany({
          where: {
            id,
            version: dto.expectedVersion,
            status: 'PENDING_APPROVAL',
          },
          data: requestUpdate,
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({ code: 'HR_REQUEST_STATE_CHANGED' });
        }
        const updated = await tx.hrRequest.findUniqueOrThrow({
          where: { id },
          include: requestInclude,
        });
        await this.audit.log(
          'HrRequest',
          id,
          action,
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        if (action === 'REJECT') {
          await this.writeEvent(
            tx,
            updated,
            'HR_REQUEST_REJECTED',
            [updated.createdByUserId],
            'rejected',
          );
        } else if (nextApproverId) {
          await this.writeEvent(
            tx,
            updated,
            'HR_REQUEST_APPROVAL_REQUIRED',
            await this.resolveActiveUserIdsForEmployees(tx, [nextApproverId]),
            'approval-required',
          );
        } else {
          await this.writeEvent(
            tx,
            updated,
            'HR_REQUEST_APPROVED',
            [updated.createdByUserId],
            'approved',
          );
        }
        const result = this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  private async findInScope(tx: Prisma.TransactionClient, id: string) {
    const request = await tx.hrRequest.findFirst({
      where: { id, ...this.scope.hrRequestWhere() },
      include: requestInclude,
    });
    if (!request) throw new NotFoundException({ code: 'HR_REQUEST_NOT_FOUND' });
    return request;
  }

  private async assertActorEmployee(actor: AuthenticatedUser) {
    if (!actor.employeeId) {
      throw new ForbiddenException({ code: 'HR_REQUEST_EMPLOYEE_REQUIRED' });
    }
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: actor.employeeId,
        isActive: true,
        ...this.scope.employeeWhere(),
      },
      include: { company: { select: { companyGroupId: true } } },
    });
    if (!employee) {
      throw new NotFoundException({ code: 'HR_REQUEST_EMPLOYEE_NOT_FOUND' });
    }
    return employee;
  }

  private async findActiveActorEmployee(actor: AuthenticatedUser) {
    if (!actor.employeeId) return null;
    return this.prisma.employee.findFirst({
      where: {
        id: actor.employeeId,
        isActive: true,
        ...this.scope.employeeWhere(),
      },
      select: { id: true },
    });
  }

  private decorate(request: RequestDetail, actor: AuthenticatedUser) {
    const canApprove = this.isPendingApprover(request, actor);
    const allowedActions: Array<'APPROVE' | 'REJECT' | 'COMPLETE' | 'CANCEL'> =
      [];
    if (canApprove) allowedActions.push('APPROVE', 'REJECT');
    if (request.status === 'APPROVED' && this.canManage(actor)) {
      allowedActions.push('COMPLETE', 'CANCEL');
    }
    if (
      request.status === 'PENDING_APPROVAL' &&
      (actor.employeeId === request.employeeId || this.canManage(actor))
    ) {
      allowedActions.push('CANCEL');
    }
    return {
      id: request.id,
      companyId: request.companyId,
      branchId: request.branchId,
      employeeId: request.employeeId,
      requestTypeId: request.requestTypeId,
      requestNo: request.requestNo,
      requestDate: request.requestDate,
      remarks: request.remarks,
      fileObjectId: request.fileObjectId,
      attachment: this.attachmentSummary(request),
      status: request.status,
      version: request.version,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      approvedAt: request.approvedAt,
      rejectedAt: request.rejectedAt,
      completedAt: request.completedAt,
      cancelledAt: request.cancelledAt,
      branch: request.branch,
      employee: {
        id: request.employee.id,
        firstName: request.employee.firstName,
        lastName: request.employee.lastName,
        employeeCode: request.employee.employeeCode,
        department: request.employee.department,
        designation: request.employee.designation,
      },
      requestType: request.requestType,
      approvalTransaction: request.approvalTransaction
        ? {
            status: request.approvalTransaction.status,
            currentStep: request.approvalTransaction.currentStep,
            pendingApprover: this.pendingApproverLabel(
              request.approvalTransaction,
            ),
          }
        : null,
      allowedActions,
      actionRequirements: {
        expectedVersion: request.version,
        cancellationReasonRequired: allowedActions.includes('CANCEL'),
        rejectionReasonRequired: allowedActions.includes('REJECT'),
      },
    };
  }

  private isPendingApprover(request: RequestDetail, actor: AuthenticatedUser) {
    const currentStep = request.approvalTransaction?.approvalSteps.find(
      (step) => step.stepNo === request.approvalTransaction?.currentStep,
    );
    return Boolean(
      actor.employeeId &&
      currentStep?.status === 'PENDING' &&
      currentStep.approverId === actor.employeeId &&
      actor.employeeId !== request.employeeId,
    );
  }

  private attachmentSummary(request: RequestDetail) {
    if (!request.fileObjectId) {
      return { present: false, fileName: null, status: null };
    }
    const fileObject = request.fileObject;
    const fileName = fileObject
      ? (this.filenameEncryption.decrypt({
          ciphertext: fileObject.originalFileNameEncrypted,
          nonce: fileObject.fileNameEncNonce,
          tag: fileObject.fileNameEncTag,
          keyVersion: fileObject.fileNameEncKeyVersion,
        }) ?? `attachment.${fileObject.safeExtension ?? 'bin'}`)
      : null;
    return {
      present: true,
      fileName,
      status: fileObject?.status ?? null,
    };
  }

  private pendingApproverLabel(
    transaction: NonNullable<RequestDetail['approvalTransaction']>,
  ) {
    const current =
      transaction.approvalSteps.find(
        (step) =>
          step.stepNo === transaction.currentStep && step.status === 'PENDING',
      ) ?? transaction.approvalSteps.find((step) => step.status === 'PENDING');
    if (!current?.approver) return null;
    const name = [current.approver.firstName, current.approver.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      id: current.approver.id,
      firstName: current.approver.firstName,
      lastName: current.approver.lastName,
      employeeCode: current.approver.employeeCode,
      displayName: name || current.approver.employeeCode || 'Assigned approver',
    };
  }

  private async findCurrentApproverTransactionIds(actor: AuthenticatedUser) {
    if (!actor.employeeId) return [];
    const transactions = await this.prisma.approvalTransaction.findMany({
      where: {
        entityType: 'HR_REQUEST',
        status: 'PENDING',
        approvalSteps: {
          some: { approverId: actor.employeeId, status: 'PENDING' },
        },
      },
      select: {
        id: true,
        currentStep: true,
        approvalSteps: {
          where: { approverId: actor.employeeId, status: 'PENDING' },
          select: { stepNo: true },
        },
      },
    });
    return transactions
      .filter((transaction) =>
        transaction.approvalSteps.some(
          (step) => step.stepNo === transaction.currentStep,
        ),
      )
      .map((transaction) => transaction.id);
  }

  private canReadAll(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.requests.read') ||
      actor.authorization.permissions.includes('hr.requests.manage')
    );
  }

  private canManage(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.requests.manage')
    );
  }

  private requireActiveCompany() {
    const companyId = this.scope.current().activeCompanyId;
    if (!companyId) {
      throw new ForbiddenException({ code: 'COMPANY_SCOPE_REQUIRED' });
    }
    return companyId;
  }

  private assertVersion(actual: number, expected: number) {
    if (actual !== expected) {
      throw new ConflictException({
        code: 'HR_REQUEST_STATE_CHANGED',
        message: 'Record version changed; refresh and retry',
      });
    }
  }

  private async resolveActiveUserIdsForEmployees(
    tx: Prisma.TransactionClient,
    employeeIds: string[],
  ): Promise<string[]> {
    if (employeeIds.length === 0) return [];
    const users = await tx.user.findMany({
      where: {
        employeeId: { in: [...new Set(employeeIds)] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async writeEvent(
    tx: Prisma.TransactionClient,
    request: RequestDetail,
    eventType: string,
    userIds: Array<string | null | undefined>,
    suffix: string,
  ) {
    const recipientUserIds = [
      ...new Set(userIds.filter((value): value is string => Boolean(value))),
    ];
    await this.outbox.write(tx, {
      aggregateType: 'HrRequest',
      aggregateId: request.id,
      eventType,
      dedupeKey: `hr-request:${request.id}:${suffix}:${request.version}`,
      companyId: request.companyId,
      branchId: request.branchId,
      companyGroupId: request.employee.company?.companyGroupId ?? null,
      payload: {
        employeeId: request.employeeId,
        companyId: request.companyId,
        branchId: request.branchId,
        status: request.status,
        recipientUserIds,
      },
    });
  }

  private snapshot(result: unknown) {
    // Keep receipt replay byte-for-byte equivalent to the safe HTTP response.
    // JSON serialization also prevents accidental persistence of Prisma-only
    // values or prototype data in the receipt.
    return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  }
}
