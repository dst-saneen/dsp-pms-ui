import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';

import { WorkforceWorkflowCode } from '../../common/constants/workforce-time-contracts';
import { inclusiveUpperDateFilter } from '../../common/helpers/query-date-bound.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import {
  type ClearanceActorDepartment,
  EmployeeClearanceService,
} from '../employee-clearance/employee-clearance.service';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import {
  type ResolvedApprovalWorkflow,
  WorkforceApprovalResolverService,
} from '../workforce-approval/workforce-approval-resolver.service';

import {
  ClearanceDepartmentMappingDto,
  CreateEmployeeSeparationDto,
  MANUAL_CLEARANCE_TYPES,
} from './dto/create-employee-separation.dto';
import { CancelSeparationDto } from './dto/cancel-separation.dto';
import { CompleteSeparationDto } from './dto/complete-separation.dto';
import { ListPendingSeparationApprovalsDto } from './dto/list-pending-separation-approvals.dto';
import { ProcessSeparationDto } from './dto/process-separation.dto';
import { SeparationFilterDto } from './dto/separation-filter.dto';

const ACTIVE_SEPARATION_STATUSES = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CLEARANCE_IN_PROGRESS',
] as const;

const separationInclude = {
  employee: {
    select: {
      id: true,
      employeeCode: true,
      firstName: true,
      lastName: true,
      managerId: true,
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
  clearance: {
    include: {
      items: {
        include: {
          clearedBy: {
            select: {
              id: true,
              employeeCode: true,
              firstName: true,
              lastName: true,
            },
          },
          executorDepartment: {
            select: { id: true, departmentCode: true, departmentName: true },
          },
          assetClearanceDetailItems: {
            where: { status: 'OPEN' },
            select: { id: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  },
} satisfies Prisma.EmployeeSeparationInclude;

type SeparationBase = Prisma.EmployeeSeparationGetPayload<{
  include: typeof separationInclude;
}>;

type ApprovalRecord = Prisma.ApprovalTransactionGetPayload<{
  include: {
    approvalSteps: {
      include: {
        approver: {
          select: {
            id: true;
            employeeCode: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
  };
}>;

type SeparationRecord = SeparationBase & {
  approvalTransaction: ApprovalRecord | null;
};

type DbClient = Prisma.TransactionClient;
type Decision = 'APPROVE' | 'REJECT';

@Injectable()
export class EmployeeSeparationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: EmployeeDomainScopeService,
    private readonly approvals: WorkforceApprovalResolverService,
    private readonly clearances: EmployeeClearanceService,
    private readonly receipts: HrOperationsCommandReceiptService,
    private readonly audit: AuditService,
    private readonly outbox: OutboxWriterService,
  ) {}

  async create(dto: CreateEmployeeSeparationDto, actor: AuthenticatedUser) {
    this.assertManage(actor);
    if (!dto.reason?.trim() || dto.reason.trim().length < 3) {
      throw new BadRequestException({
        code: 'EMPLOYEE_SEPARATION_REASON_REQUIRED',
      });
    }
    const companyId = this.requireActiveCompany();
    const clearanceDepartments = this.normaliseClearanceDepartments(
      dto.clearanceDepartments,
    );

    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: 'CREATE_EMPLOYEE_SEPARATION',
      operationId: dto.operationId,
      requestPayload: {
        employeeId: dto.employeeId,
        separationType: dto.separationType,
        resignationDate: dto.resignationDate ?? null,
        lastWorkingDate: dto.lastWorkingDate,
        reason: dto.reason?.trim() || null,
        clearanceDepartments,
      },
      execute: async (tx) => {
        const employee = await tx.employee.findFirst({
          where: {
            id: dto.employeeId,
            isActive: true,
            ...this.scope.employeeWhere(),
          },
          select: {
            id: true,
            companyId: true,
            branchId: true,
            managerId: true,
            company: { select: { companyGroupId: true } },
          },
        });
        if (
          !employee ||
          employee.companyId !== companyId ||
          (this.scope.current().activeBranchId &&
            employee.branchId !== this.scope.current().activeBranchId)
        ) {
          throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND' });
        }

        // One employee row lock makes concurrent, differently-idempotenced starts
        // serialize before the active-separation check below.
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "employees" WHERE id = ${employee.id} FOR UPDATE`,
        );

        const existing = await tx.employeeSeparation.findFirst({
          where: {
            employeeId: employee.id,
            companyId: employee.companyId,
            status: { in: [...ACTIVE_SEPARATION_STATUSES] },
          },
          select: { id: true },
        });
        if (existing) {
          throw new ConflictException({
            code: 'ACTIVE_EMPLOYEE_SEPARATION_EXISTS',
            message: 'The employee already has an active separation.',
          });
        }

        await this.assertClearanceDepartments(
          tx,
          clearanceDepartments,
          employee.companyId,
          employee.branchId,
        );

        let workflow: ResolvedApprovalWorkflow;
        try {
          workflow = await this.approvals.resolveWorkflow(
            {
              workflowCode: WorkforceWorkflowCode.EMPLOYEE_SEPARATION,
              companyId: employee.companyId,
            },
            tx,
          );
        } catch {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_WORKFLOW_NOT_CONFIGURED',
            message:
              'Configure an active Company Employee Separation approval workflow before starting a separation.',
          });
        }
        if (workflow.steps.length === 0) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_WORKFLOW_NOT_CONFIGURED',
            message:
              'Configure at least one Company Employee Separation approval step before starting a separation.',
          });
        }

        const separation = await tx.employeeSeparation.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId: employee.id,
            separationType: dto.separationType,
            resignationDate: dto.resignationDate
              ? new Date(dto.resignationDate)
              : null,
            lastWorkingDate: new Date(dto.lastWorkingDate),
            reason: dto.reason?.trim() || null,
            createdByUserId: actor.id,
            status: 'PENDING_APPROVAL',
          },
        });

        const clearance = await tx.employeeClearance.create({
          data: {
            companyId: employee.companyId,
            branchId: employee.branchId,
            separationId: separation.id,
            status: 'PENDING',
          },
        });

        await tx.employeeClearanceItem.createMany({
          data: [
            {
              companyId: employee.companyId,
              branchId: employee.branchId,
              clearanceId: clearance.id,
              clearanceType: 'ASSET',
              itemName: 'Asset Return',
              // The Asset domain is the source of truth. This summary item deliberately
              // has no Department executor and cannot be manually cleared.
              executorDepartmentId: null,
            },
            ...clearanceDepartments.map((item) => ({
              companyId: employee.companyId,
              branchId: employee.branchId,
              clearanceId: clearance.id,
              clearanceType: item.clearanceType,
              itemName:
                item.itemName ?? this.defaultItemName(item.clearanceType),
              executorDepartmentId: item.executorDepartmentId,
            })),
          ],
        });

        const transaction = await tx.approvalTransaction.create({
          data: {
            workflowId: workflow.id,
            entityType: 'EMPLOYEE_SEPARATION',
            entityId: separation.id,
            requestedById: employee.id,
            currentStep: workflow.steps[0].stepNo,
            status: 'PENDING',
          },
        });

        const approverEmployeeIds: string[] = [];
        for (const step of workflow.steps) {
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
            throw new ConflictException({
              code: 'EMPLOYEE_SEPARATION_APPROVER_NOT_AVAILABLE',
              message:
                'Every Employee Separation approval step requires an eligible approver.',
            });
          }
          approverEmployeeIds.push(approverId);
          await tx.approvalTransactionStep.create({
            data: {
              transactionId: transaction.id,
              stepNo: step.stepNo,
              approverId,
              status: 'PENDING',
            },
          });
        }

        await tx.employeeSeparation.update({
          where: { id: separation.id },
          data: { approvalTransactionId: transaction.id },
        });
        const detailed = await this.findInScope(tx, separation.id);
        await this.audit.log(
          'EmployeeSeparation',
          separation.id,
          'CREATE',
          null,
          {
            status: detailed.status,
            separationType: detailed.separationType,
            clearanceId: clearance.id,
          },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          detailed,
          'EMPLOYEE_SEPARATION_CREATED',
          await this.resolveUserIds(tx, approverEmployeeIds, actor.id),
          'created',
        );
        const result = await this.decorate(detailed, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  async findClearanceDepartmentCandidates(employeeId: string) {
    const activeScope = this.scope.current();
    const activeCompanyId = activeScope.activeCompanyId;
    if (!activeCompanyId) {
      throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND' });
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, ...this.scope.employeeWhere() },
      select: { companyId: true, branchId: true },
    });
    if (
      !employee ||
      employee.companyId !== activeCompanyId ||
      (activeScope.activeBranchId &&
        employee.branchId !== activeScope.activeBranchId)
    ) {
      throw new NotFoundException({ code: 'EMPLOYEE_NOT_FOUND' });
    }
    return this.prisma.department.findMany({
      where: {
        companyId: employee.companyId,
        branchId: employee.branchId,
        isActive: true,
      },
      select: { id: true, departmentCode: true, departmentName: true },
      orderBy: { departmentName: 'asc' },
    });
  }

  async findAll(filters: SeparationFilterDto, actor: AuthenticatedUser) {
    const canReadAll = this.canReadAll(actor);
    const approverTransactionIds = canReadAll
      ? undefined
      : await this.findApproverTransactionIds(actor);
    const where: Prisma.EmployeeSeparationWhereInput = {
      ...this.scope.employeeSeparationWhere(),
      ...(canReadAll
        ? {}
        : { approvalTransactionId: { in: approverTransactionIds } }),
      ...(filters.employeeId && canReadAll
        ? { employeeId: filters.employeeId }
        : {}),
      ...(filters.status
        ? { status: filters.status.trim().toUpperCase() }
        : {}),
      ...(filters.separationType
        ? { separationType: filters.separationType.trim().toUpperCase() }
        : {}),
      ...(filters.keyword
        ? {
            OR: [
              {
                reason: {
                  contains: filters.keyword.trim(),
                  mode: 'insensitive',
                },
              },
              {
                employee: {
                  employeeCode: {
                    contains: filters.keyword.trim(),
                    mode: 'insensitive',
                  },
                },
              },
              {
                employee: {
                  firstName: {
                    contains: filters.keyword.trim(),
                    mode: 'insensitive',
                  },
                },
              },
              {
                employee: {
                  lastName: {
                    contains: filters.keyword.trim(),
                    mode: 'insensitive',
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.employeeSeparation.findMany({
        where,
        include: separationInclude,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.employeeSeparation.count({ where }),
    ]);
    const detailed = await this.withApprovals(this.prisma, rows);
    const actorDepartment = await this.clearances.getActorDepartment(actor);
    return {
      items: await Promise.all(
        detailed.map((row) => this.decorate(row, actor, actorDepartment)),
      ),
      total,
      page: filters.page,
      limit: filters.limit,
      allowedActions: this.canManage(actor) ? ['CREATE'] : [],
    };
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const separation = await this.findInScope(this.prisma, id);
    if (
      !this.canReadAll(actor) &&
      !this.isAssignedApprover(separation, actor)
    ) {
      throw new NotFoundException({ code: 'EMPLOYEE_SEPARATION_NOT_FOUND' });
    }
    return this.decorate(separation, actor);
  }

  async pendingApprovals(
    actor: AuthenticatedUser,
    filters: ListPendingSeparationApprovalsDto = new ListPendingSeparationApprovalsDto(),
  ) {
    const paginationRequested =
      filters.page !== undefined || filters.limit !== undefined;
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 25;
    const transactionIds = await this.findApproverTransactionIds(actor, true);
    if (transactionIds.length === 0) {
      return { items: [], total: 0, page, limit };
    }
    const keyword = filters.keyword?.trim();
    const filterWhere: Prisma.EmployeeSeparationWhereInput = {
      ...(filters.branchId ? { branchId: filters.branchId } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.separationType
        ? { separationType: filters.separationType.trim().toUpperCase() }
        : {}),
      ...(filters.submittedFrom || filters.submittedTo
        ? {
            createdAt: {
              ...(filters.submittedFrom
                ? { gte: new Date(filters.submittedFrom) }
                : {}),
              ...(filters.submittedTo
                ? inclusiveUpperDateFilter(filters.submittedTo)
                : {}),
            },
          }
        : {}),
      ...(filters.lastWorkingDateFrom || filters.lastWorkingDateTo
        ? {
            lastWorkingDate: {
              ...(filters.lastWorkingDateFrom
                ? { gte: new Date(filters.lastWorkingDateFrom) }
                : {}),
              ...(filters.lastWorkingDateTo
                ? inclusiveUpperDateFilter(filters.lastWorkingDateTo)
                : {}),
            },
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              { reason: { contains: keyword, mode: 'insensitive' } },
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
            ],
          }
        : {}),
    };
    const where: Prisma.EmployeeSeparationWhereInput = {
      AND: [
        this.scope.employeeSeparationWhere(),
        {
          status: 'PENDING_APPROVAL',
          employeeId: { not: actor.employeeId ?? '__no_employee__' },
          approvalTransactionId: { in: transactionIds },
        },
        filterWhere,
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.employeeSeparation.findMany({
        where,
        include: separationInclude,
        orderBy: { createdAt: 'asc' },
        ...(paginationRequested
          ? { skip: (page - 1) * limit, take: limit }
          : {}),
      }),
      this.prisma.employeeSeparation.count({ where }),
    ]);
    const detailed = await this.withApprovals(this.prisma, rows);
    const actorDepartment = await this.clearances.getActorDepartment(actor);
    const decorated = await Promise.all(
      detailed.map((row) => this.decorate(row, actor, actorDepartment)),
    );
    return {
      items: decorated,
      total,
      page,
      limit,
    };
  }

  async approve(
    id: string,
    dto: ProcessSeparationDto,
    actor: AuthenticatedUser,
  ) {
    return this.decide(id, dto, actor, 'APPROVE');
  }

  async reject(
    id: string,
    dto: ProcessSeparationDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.remarks?.trim() || dto.remarks.trim().length < 3) {
      throw new BadRequestException({
        code: 'EMPLOYEE_SEPARATION_REJECTION_REASON_REQUIRED',
      });
    }
    return this.decide(id, dto, actor, 'REJECT');
  }

  async cancel(id: string, dto: CancelSeparationDto, actor: AuthenticatedUser) {
    if (!dto.reason?.trim() || dto.reason.trim().length < 3) {
      throw new BadRequestException({
        code: 'EMPLOYEE_SEPARATION_CANCELLATION_REASON_REQUIRED',
      });
    }
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: 'CANCEL_EMPLOYEE_SEPARATION',
      operationId: dto.operationId,
      requestPayload: {
        id,
        expectedVersion: dto.expectedVersion,
        reason: dto.reason?.trim() || null,
      },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        this.assertVersion(current.version, dto.expectedVersion);
        const mayCancel =
          this.canManage(actor) || current.createdByUserId === actor.id;
        if (!mayCancel) {
          throw new ForbiddenException({
            code: 'EMPLOYEE_SEPARATION_CANCEL_NOT_ALLOWED',
          });
        }
        if (current.status !== 'PENDING_APPROVAL') {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        const transitioned = await tx.employeeSeparation.updateMany({
          where: {
            id,
            companyId,
            version: dto.expectedVersion,
            status: 'PENDING_APPROVAL',
          },
          data: {
            status: 'CANCELLED',
            cancelledByUserId: actor.id,
            cancelledAt: new Date(),
            cancellationReason: dto.reason?.trim() || null,
            version: { increment: 1 },
          },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        if (current.approvalTransactionId) {
          await tx.approvalTransaction.update({
            where: { id: current.approvalTransactionId },
            data: { status: 'CANCELLED' },
          });
        }
        const updated = await this.findInScope(tx, id);
        await this.audit.log(
          'EmployeeSeparation',
          id,
          'CANCEL',
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          updated,
          'EMPLOYEE_SEPARATION_CANCELLED',
          [actor.id, current.createdByUserId].filter((value): value is string =>
            Boolean(value),
          ),
          'cancelled',
        );
        const result = await this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  async complete(
    id: string,
    dto: CompleteSeparationDto,
    actor: AuthenticatedUser,
  ) {
    this.assertManage(actor);
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: 'COMPLETE_EMPLOYEE_SEPARATION',
      operationId: dto.operationId,
      requestPayload: {
        id,
        expectedVersion: dto.expectedVersion,
        clearanceRemarks: dto.clearanceRemarks?.trim() || null,
      },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        this.assertVersion(current.version, dto.expectedVersion);
        if (current.status !== 'CLEARANCE_IN_PROGRESS' || !current.clearance) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }

        await this.clearances.finalizeForSeparation(
          tx,
          current.clearance.id,
          current.clearance.version,
          current.employeeId,
          actor,
        );
        const employee = await tx.employee.updateMany({
          where: {
            id: current.employeeId,
            companyId: current.companyId,
            branchId: current.branchId,
            isActive: true,
          },
          data: {
            employmentStatus: this.employmentStatusFor(current.separationType),
            isActive: false,
          },
        });
        if (employee.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        await tx.user.updateMany({
          where: {
            employeeId: current.employeeId,
            status: { in: [UserStatus.ACTIVE, UserStatus.LOCKED] },
          },
          data: {
            status: UserStatus.DISABLED,
            securityVersion: { increment: 1 },
          },
        });
        const transitioned = await tx.employeeSeparation.updateMany({
          where: {
            id,
            companyId,
            version: dto.expectedVersion,
            status: 'CLEARANCE_IN_PROGRESS',
          },
          data: {
            status: 'COMPLETED',
            completedByUserId: actor.id,
            completedDate: new Date(),
            clearanceRemarks: dto.clearanceRemarks?.trim() || null,
            version: { increment: 1 },
          },
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        await tx.employeeCareerEvent.create({
          data: {
            employeeId: current.employeeId,
            eventType: 'SEPARATION',
            eventAt: new Date(),
            employeeVisibleSummary: 'Employment separation completed.',
            hrDetailReference: `Employee separation ${id}`,
            sourceModule: 'EMPLOYEE_SEPARATION',
            sourceRecordId: id,
            actorUserId: actor.id,
          },
        });
        const updated = await this.findInScope(tx, id);
        await this.audit.log(
          'EmployeeSeparation',
          id,
          'COMPLETE',
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          updated,
          'EMPLOYEE_SEPARATION_COMPLETED',
          [actor.id, current.createdByUserId].filter((value): value is string =>
            Boolean(value),
          ),
          'completed',
        );
        const result = await this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  private async decide(
    id: string,
    dto: ProcessSeparationDto,
    actor: AuthenticatedUser,
    action: Decision,
  ) {
    if (!actor.employeeId) {
      throw new ForbiddenException({
        code: 'EMPLOYEE_SEPARATION_APPROVER_EMPLOYEE_REQUIRED',
      });
    }
    const companyId = this.requireActiveCompany();
    return this.receipts.execute({
      companyId,
      actorUserId: actor.id,
      commandType: `${action}_EMPLOYEE_SEPARATION`,
      operationId: dto.operationId,
      requestPayload: {
        id,
        expectedVersion: dto.expectedVersion,
        remarks: dto.remarks?.trim() || null,
      },
      execute: async (tx) => {
        const current = await this.findInScope(tx, id);
        this.assertVersion(current.version, dto.expectedVersion);
        const transaction = current.approvalTransaction;
        if (current.status !== 'PENDING_APPROVAL' || !transaction) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        if (current.employeeId === actor.employeeId) {
          throw new ForbiddenException({
            code: 'EMPLOYEE_SEPARATION_SELF_APPROVAL_FORBIDDEN',
          });
        }
        const step = transaction.approvalSteps.find(
          (item) => item.stepNo === transaction.currentStep,
        );
        if (
          !step ||
          step.status !== 'PENDING' ||
          step.approverId !== actor.employeeId
        ) {
          throw new ForbiddenException({
            code: 'EMPLOYEE_SEPARATION_APPROVER_NOT_ELIGIBLE',
          });
        }
        const now = new Date();
        await tx.approvalTransactionStep.update({
          where: { id: step.id },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            remarks: dto.remarks?.trim() || null,
            actionDate: now,
          },
        });

        let eventType: string;
        let eventSuffix: string;
        let recipientEmployeeIds: string[] = [];
        let mutation: Prisma.EmployeeSeparationUncheckedUpdateManyInput;
        if (action === 'REJECT') {
          await tx.approvalTransaction.update({
            where: { id: transaction.id },
            data: { status: 'REJECTED' },
          });
          mutation = {
            status: 'REJECTED',
            rejectedByUserId: actor.id,
            rejectedAt: now,
            version: { increment: 1 },
          };
          eventType = 'EMPLOYEE_SEPARATION_REJECTED';
          eventSuffix = 'rejected';
        } else {
          const next = transaction.approvalSteps.find(
            (item) =>
              item.stepNo > transaction.currentStep &&
              item.status === 'PENDING',
          );
          if (next) {
            await tx.approvalTransaction.update({
              where: { id: transaction.id },
              data: { currentStep: next.stepNo },
            });
            mutation = { version: { increment: 1 } };
            recipientEmployeeIds = next.approverId ? [next.approverId] : [];
            eventType = 'EMPLOYEE_SEPARATION_APPROVAL_ADVANCED';
            eventSuffix = `approval-step-${next.stepNo}`;
          } else {
            await tx.approvalTransaction.update({
              where: { id: transaction.id },
              data: { status: 'APPROVED' },
            });
            const activated = await tx.employeeClearance.updateMany({
              where: {
                separationId: current.id,
                status: 'PENDING',
              },
              data: { status: 'IN_PROGRESS', version: { increment: 1 } },
            });
            if (activated.count !== 1 || !current.clearance) {
              throw new ConflictException({
                code: 'EMPLOYEE_CLEARANCE_STATE_CHANGED',
              });
            }
            await this.clearances.syncAssetClearanceItems(
              current.clearance.id,
              tx,
            );
            mutation = {
              status: 'CLEARANCE_IN_PROGRESS',
              approvedByUserId: actor.id,
              approvedAt: now,
              version: { increment: 1 },
            };
            eventType = 'EMPLOYEE_SEPARATION_APPROVED';
            eventSuffix = 'approved';
          }
        }
        const transitioned = await tx.employeeSeparation.updateMany({
          where: {
            id,
            companyId,
            version: dto.expectedVersion,
            status: 'PENDING_APPROVAL',
          },
          data: mutation,
        });
        if (transitioned.count !== 1) {
          throw new ConflictException({
            code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
          });
        }
        const updated = await this.findInScope(tx, id);
        await this.audit.log(
          'EmployeeSeparation',
          id,
          action,
          { status: current.status },
          { status: updated.status },
          { tx, userId: actor.id },
        );
        await this.writeEvent(
          tx,
          updated,
          eventType,
          await this.resolveUserIds(tx, recipientEmployeeIds, actor.id),
          eventSuffix,
        );
        const result = await this.decorate(updated, actor);
        return { snapshot: this.snapshot(result), result };
      },
    });
  }

  private async findInScope(db: PrismaService | DbClient, id: string) {
    const separation = await db.employeeSeparation.findFirst({
      where: { id, ...this.scope.employeeSeparationWhere() },
      include: separationInclude,
    });
    if (!separation) {
      throw new NotFoundException({ code: 'EMPLOYEE_SEPARATION_NOT_FOUND' });
    }
    const [detailed] = await this.withApprovals(db, [separation]);
    return detailed;
  }

  private async withApprovals(
    db: PrismaService | DbClient,
    rows: SeparationBase[],
  ): Promise<SeparationRecord[]> {
    const ids = rows
      .map((row) => row.approvalTransactionId)
      .filter((id): id is string => Boolean(id));
    const approvals = ids.length
      ? await db.approvalTransaction.findMany({
          where: { id: { in: ids } },
          include: {
            approvalSteps: {
              include: {
                approver: {
                  select: {
                    id: true,
                    employeeCode: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
              orderBy: { stepNo: 'asc' },
            },
          },
        })
      : [];
    const byId = new Map(approvals.map((approval) => [approval.id, approval]));
    return rows.map((row) => ({
      ...row,
      approvalTransaction: row.approvalTransactionId
        ? (byId.get(row.approvalTransactionId) ?? null)
        : null,
    }));
  }

  private async decorate(
    record: SeparationRecord,
    actor: AuthenticatedUser,
    actorDepartment?: ClearanceActorDepartment | null,
  ) {
    const resolvedActorDepartment =
      actorDepartment === undefined
        ? await this.clearances.getActorDepartment(actor)
        : actorDepartment;
    const currentStep = record.approvalTransaction?.approvalSteps.find(
      (step) => step.stepNo === record.approvalTransaction?.currentStep,
    );
    const manualItems =
      record.clearance?.items.filter(
        (item) => item.clearanceType !== 'ASSET',
      ) ?? [];
    const mandatoryCleared = manualItems.filter(
      (item) => item.status === 'CLEARED',
    ).length;
    const assetClearanceBlocked = Boolean(
      record.clearance?.items.some(
        (item) => item.assetClearanceDetailItems.length > 0,
      ),
    );
    const canApprove = Boolean(
      actor.employeeId &&
      record.status === 'PENDING_APPROVAL' &&
      currentStep?.status === 'PENDING' &&
      currentStep.approverId === actor.employeeId &&
      record.employeeId !== actor.employeeId,
    );
    const readyToComplete =
      record.status === 'CLEARANCE_IN_PROGRESS' &&
      Boolean(record.clearance) &&
      mandatoryCleared === manualItems.length &&
      !assetClearanceBlocked;
    const allowedActions: Array<'APPROVE' | 'REJECT' | 'CANCEL' | 'COMPLETE'> =
      [];
    if (canApprove) allowedActions.push('APPROVE', 'REJECT');
    if (
      record.status === 'PENDING_APPROVAL' &&
      (this.canManage(actor) || record.createdByUserId === actor.id)
    ) {
      allowedActions.push('CANCEL');
    }
    if (readyToComplete && this.canManage(actor))
      allowedActions.push('COMPLETE');
    return {
      id: record.id,
      companyId: record.companyId,
      branchId: record.branchId,
      employeeId: record.employeeId,
      separationType: record.separationType,
      lastWorkingDate: record.lastWorkingDate,
      reason: record.reason,
      status: record.status,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      approvedAt: record.approvedAt,
      completedAt: record.completedDate,
      branch: record.branch,
      employee: record.employee,
      approvalProgress: currentStep
        ? {
            currentStepName: `Waiting on ${
              currentStep.approver
                ? `${currentStep.approver.firstName} ${currentStep.approver.lastName ?? ''}`.trim()
                : `step ${currentStep.stepNo}`
            }`,
            currentApproverLabel: currentStep.approver
              ? `${currentStep.approver.firstName} ${currentStep.approver.lastName ?? ''}`.trim()
              : null,
          }
        : null,
      clearanceSummary: record.clearance
        ? {
            mandatoryTotal: manualItems.length,
            mandatoryCleared,
            mandatoryOutstanding: manualItems.length - mandatoryCleared,
            assetClearanceBlocked,
          }
        : null,
      clearanceItems: record.clearance?.items.map((item) => {
        const itemActions = this.clearances.allowedActionsForItem(
          {
            clearanceType: item.clearanceType,
            companyId: item.companyId,
            branchId: item.branchId,
            executorDepartmentId: item.executorDepartmentId,
            status: item.status,
            clearance: {
              status: record.clearance?.status ?? 'PENDING',
              separation: { status: record.status },
            },
          },
          actor,
          resolvedActorDepartment,
        );
        return {
          id: item.id,
          separationId: record.id,
          executorDepartmentId: item.executorDepartmentId,
          executorDepartmentName:
            item.executorDepartment?.departmentName ?? null,
          itemType: item.clearanceType,
          title: item.itemName,
          mandatory: item.clearanceType !== 'ASSET',
          status: item.status,
          version: item.version,
          clearedAt: item.clearedDate,
          clearedBy: item.clearedBy,
          allowedActions: itemActions,
          actionRequirements: {
            expectedVersion: item.version,
            requiresReason:
              itemActions.includes('CLEAR') || itemActions.includes('REOPEN'),
          },
        };
      }),
      allowedActions,
      actionRequirements: {
        expectedVersion: record.version,
        requiresReason:
          allowedActions.includes('REJECT') ||
          allowedActions.includes('CANCEL'),
      },
      completePreflight: {
        readyToComplete: readyToComplete,
        assetClearanceBlocked,
        mandatoryOutstanding: manualItems.length - mandatoryCleared,
        effects: [
          'Employee record is deactivated',
          'User sessions for the linked account are ended',
          'Open asset custody must already be resolved or waived',
        ],
      },
    };
  }

  private async findApproverTransactionIds(
    actor: AuthenticatedUser,
    currentOnly = false,
  ) {
    if (!actor.employeeId) return [];
    if (currentOnly) {
      const transactions = await this.prisma.approvalTransaction.findMany({
        where: {
          entityType: 'EMPLOYEE_SEPARATION',
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
    const transactions = await this.prisma.approvalTransaction.findMany({
      where: {
        entityType: 'EMPLOYEE_SEPARATION',
        approvalSteps: {
          some: {
            approverId: actor.employeeId,
          },
        },
      },
      select: { id: true },
    });
    return transactions.map((transaction) => transaction.id);
  }

  private isAssignedApprover(
    record: SeparationRecord,
    actor: AuthenticatedUser,
  ) {
    return Boolean(
      actor.employeeId &&
      record.approvalTransaction?.approvalSteps.some(
        (step) => step.approverId === actor.employeeId,
      ),
    );
  }

  private normaliseClearanceDepartments(
    mappings: ClearanceDepartmentMappingDto[],
  ) {
    if (
      !Array.isArray(mappings) ||
      mappings.length !== MANUAL_CLEARANCE_TYPES.length
    ) {
      throw new BadRequestException({
        code: 'EMPLOYEE_CLEARANCE_DEPARTMENTS_REQUIRED',
        message:
          'Exactly one Department is required for HR, Finance, IT, and Admin clearance.',
      });
    }
    const byType = new Map(mappings.map((item) => [item.clearanceType, item]));
    if (
      byType.size !== MANUAL_CLEARANCE_TYPES.length ||
      MANUAL_CLEARANCE_TYPES.some((type) => !byType.has(type))
    ) {
      throw new BadRequestException({
        code: 'EMPLOYEE_CLEARANCE_DEPARTMENTS_INVALID',
        message: 'Each manual clearance type must be mapped once.',
      });
    }
    return MANUAL_CLEARANCE_TYPES.map((type) => {
      const item = byType.get(type)!;
      return {
        clearanceType: type,
        executorDepartmentId: item.executorDepartmentId,
        itemName: item.itemName?.trim() || undefined,
      };
    });
  }

  private async assertClearanceDepartments(
    tx: DbClient,
    mappings: Array<{
      clearanceType: string;
      executorDepartmentId: string;
      itemName?: string;
    }>,
    companyId: string,
    branchId: string,
  ) {
    const ids = [...new Set(mappings.map((item) => item.executorDepartmentId))];
    const departments = await tx.department.findMany({
      where: {
        id: { in: ids },
        companyId,
        branchId,
        isActive: true,
      },
      select: { id: true },
    });
    if (departments.length !== ids.length) {
      throw new BadRequestException({
        code: 'EMPLOYEE_CLEARANCE_DEPARTMENT_OUT_OF_SCOPE',
        message:
          'Each clearance Department must be active in the employee company and branch.',
      });
    }
  }

  private defaultItemName(type: string) {
    return (
      {
        HR: 'Leave Settlement',
        FINANCE: 'Final Settlement',
        IT: 'System Access Removal',
        ADMIN: 'ID Card Return',
      }[type] ?? type
    );
  }

  private employmentStatusFor(separationType: string) {
    if (separationType === 'TERMINATION') return 'TERMINATED';
    if (separationType === 'RETIREMENT') return 'RETIRED';
    return 'RESIGNED';
  }

  private assertManage(actor: AuthenticatedUser) {
    if (!this.canManage(actor)) throw new ForbiddenException();
  }

  private canManage(actor: AuthenticatedUser) {
    return (
      actor.authorization.isGlobal ||
      actor.authorization.permissions.includes('hr.employees.manage')
    );
  }

  private canReadAll(actor: AuthenticatedUser) {
    return (
      this.canManage(actor) ||
      actor.authorization.permissions.includes('hr.employees.read')
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
        code: 'EMPLOYEE_SEPARATION_STATE_CHANGED',
        message: 'Record version changed; refresh and retry.',
      });
    }
  }

  private async resolveUserIds(
    tx: DbClient,
    employeeIds: string[],
    actorUserId: string,
  ) {
    const users = employeeIds.length
      ? await tx.user.findMany({
          where: { employeeId: { in: employeeIds }, status: UserStatus.ACTIVE },
          select: { id: true },
        })
      : [];
    return [...new Set([actorUserId, ...users.map((user) => user.id)])];
  }

  private async writeEvent(
    tx: DbClient,
    separation: SeparationRecord,
    eventType: string,
    recipientUserIds: string[],
    suffix: string,
  ) {
    await this.outbox.write(tx, {
      aggregateType: 'EmployeeSeparation',
      aggregateId: separation.id,
      eventType,
      dedupeKey: `employee-separation:${separation.id}:${suffix}:${separation.version}`,
      companyId: separation.companyId,
      branchId: separation.branchId,
      companyGroupId: separation.employee.company.companyGroupId,
      payload: {
        employeeId: separation.employeeId,
        companyId: separation.companyId,
        branchId: separation.branchId,
        status: separation.status,
        recipientUserIds,
      },
    });
  }

  private snapshot(result: unknown) {
    // Command receipts must replay the identical public response, not an
    // abbreviated acknowledgement that forces clients down a different path.
    return JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
  }
}
