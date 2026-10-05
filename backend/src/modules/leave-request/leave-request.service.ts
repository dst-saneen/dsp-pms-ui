import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTypeCategory, Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { WorkforceWorkflowCode } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { CompOffAllocationService } from '../comp-off/comp-off-allocation.service';
import { LeaveBalanceLedgerService } from '../employee-leave-balance/leave-balance-ledger.service';
import {
  LeaveRequestStatus,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
} from '../employee-leave/constants';
import { LeavePolicyResolverService } from '../leave-policy/leave-policy-resolver.service';
import { WorkforceNotificationEventCode } from '../notification/notification-event.catalog';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import {
  canAccessLeaveHrQueue,
  classifyLeaveTransactionStep,
} from '../workforce-approval/leave-approval.util';
import { WorkforceApprovalResolverService } from '../workforce-approval/workforce-approval-resolver.service';

import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveRequestFilterDto } from './dto/leave-request-filter.dto';
import {
  ProcessLeaveRequestDto,
  RejectLeaveRequestDto,
} from './dto/process-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import {
  LEAVE_OVERLAP_STATUSES,
  SERIALIZABLE_RETRY_LIMIT,
  isSerializationFailure,
  isSubmittedLeaveStatus,
} from './leave-request.constants';
import { lockLeaveRequest } from './leave-request-lock.util';
import { buildLeaveApprovalProgress } from './leave-request-progress';

const leaveRequestViewInclude = {
  employee: {
    include: {
      company: { select: { id: true, companyGroupId: true } },
    },
  },
  leaveType: true,
  leaveBalance: true,
  approvalTransaction: {
    include: {
      approvalSteps: { orderBy: { stepNo: 'asc' as const } },
      workflow: {
        include: { steps: { orderBy: { stepNo: 'asc' as const } } },
      },
    },
  },
} satisfies Prisma.LeaveRequestInclude;

@Injectable()
export class LeaveRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leavePolicyResolver: LeavePolicyResolverService,
    private readonly workforceApprovalResolver: WorkforceApprovalResolverService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly leaveBalanceLedger: LeaveBalanceLedgerService,
    private readonly compOffAllocationService: CompOffAllocationService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
  ) {}

  async create(dto: CreateLeaveRequestDto) {
    const employee = await this.employeeDomainScope.assertEmployeeInScope(
      dto.employeeId,
    );

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: dto.leaveTypeId,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    if (leaveType.category === LeaveTypeCategory.OPTIONAL_HOLIDAY) {
      throw new BadRequestException({
        code: WorkforceErrorCode.OPTIONAL_HOLIDAY_USE_SELECTION,
        message:
          'Optional holidays must be selected from My Workspace, not Apply Leave',
      });
    }

    const fromDate = new Date(dto.fromDate);
    const toDate = new Date(dto.toDate);

    const calculation = await this.leavePolicyResolver.resolveCalculation({
      employeeId: dto.employeeId,
      leaveTypeId: dto.leaveTypeId,
      fromDate,
      toDate,
      isHalfDay: dto.isHalfDay,
    });

    await this.assertNoOverlap({
      employeeId: dto.employeeId,
      fromDate,
      toDate,
    });

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          companyId: employee.companyId,
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          fromDate,
          toDate,
          requestedDays: calculation.requestedWorkingDays,
          isHalfDay: dto.isHalfDay ?? false,
          reason: dto.reason,
          attachmentUrl: dto.attachmentUrl,
          status: LeaveRequestStatus.DRAFT,
        },
      });

      await this.syncLeaveCalendarDays(tx, created.id, calculation);

      await this.auditService.log(
        'LeaveRequest',
        created.id,
        'CREATE',
        null,
        {
          status: created.status,
          requestedDays: Number(created.requestedDays),
        },
        { tx },
      );

      return created;
    });
  }

  async findAll(filters: LeaveRequestFilterDto, actor?: AuthenticatedUser) {
    const where: Prisma.LeaveRequestWhereInput = {
      isActive: true,
      ...this.employeeDomainScope.leaveRequestWhere(),
    };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.leaveTypeId) {
      where.leaveTypeId = filters.leaveTypeId;
    }

    if (filters.status) {
      where.status = filters.status.toUpperCase();
    }

    const rows = await this.prisma.leaveRequest.findMany({
      where,
      include: leaveRequestViewInclude,
      orderBy: {
        createdAt: 'desc',
      },
    });
    return rows.map((row) => this.decorateLeaveRequest(row, actor));
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    const request = await this.prisma.leaveRequest.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.leaveRequestWhere(),
      },
      include: leaveRequestViewInclude,
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    return this.decorateLeaveRequest(request, actor);
  }

  async update(id: string, dto: UpdateLeaveRequestDto) {
    const request = await this.findOne(id);

    if (request.status !== LeaveRequestStatus.DRAFT) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
        message: 'Only draft leave requests can be edited',
      });
    }

    const fromDate = dto.fromDate ? new Date(dto.fromDate) : request.fromDate;
    const toDate = dto.toDate ? new Date(dto.toDate) : request.toDate;
    const isHalfDay = dto.isHalfDay ?? request.isHalfDay;
    const leaveTypeId = dto.leaveTypeId ?? request.leaveTypeId;

    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id: leaveTypeId,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
      select: { id: true, category: true },
    });
    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }
    if (leaveType.category === LeaveTypeCategory.OPTIONAL_HOLIDAY) {
      throw new BadRequestException({
        code: WorkforceErrorCode.OPTIONAL_HOLIDAY_USE_SELECTION,
        message:
          'Optional holidays must be selected from My Workspace, not Apply Leave',
      });
    }

    const calculation = await this.leavePolicyResolver.resolveCalculation({
      employeeId: request.employeeId,
      leaveTypeId,
      fromDate,
      toDate,
      isHalfDay,
    });

    await this.assertNoOverlap({
      employeeId: request.employeeId,
      fromDate,
      toDate,
      excludeId: id,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: {
          leaveTypeId,
          fromDate,
          toDate,
          isHalfDay,
          reason: dto.reason ?? request.reason,
          attachmentUrl: dto.attachmentUrl ?? request.attachmentUrl,
          requestedDays: calculation.requestedWorkingDays,
        },
      });

      await this.syncLeaveCalendarDays(tx, result.id, calculation);

      await this.auditService.log(
        'LeaveRequest',
        result.id,
        'UPDATE',
        {
          status: request.status,
          requestedDays: Number(request.requestedDays),
        },
        {
          status: result.status,
          requestedDays: Number(result.requestedDays),
        },
        { tx },
      );

      return result;
    });

    return updated;
  }

  /** Soft-cancel alias for DELETE; prefers cancel() for explicit reasons. */
  async remove(id: string, actor: AuthenticatedUser) {
    return this.cancel(id, {}, actor);
  }

  async submit(id: string, actor: AuthenticatedUser) {
    return this.withSerializableRetry(() => this.submitOnce(id, actor));
  }

  async approve(
    id: string,
    dto: ProcessLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.withSerializableRetry(() => this.approveOnce(id, dto, actor));
  }

  async reject(
    id: string,
    dto: RejectLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.withSerializableRetry(() => this.rejectOnce(id, dto, actor));
  }

  async cancel(
    id: string,
    dto: CancelLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.withSerializableRetry(() => this.cancelOnce(id, dto, actor));
  }

  /**
   * My Approvals: current actionable steps only.
   * queue=manager → reporting-manager step for reportees
   * queue=hr → current HR step in tenant scope
   * queue=completed → steps this actor already decided
   */
  async getPendingApprovalsForActor(
    actor: AuthenticatedUser,
    queue: 'manager' | 'hr' | 'completed' | 'actionable' = 'actionable',
  ) {
    if (queue === 'completed') {
      return this.getCompletedApprovalsForActor(actor);
    }

    const canReviewHrInScope = canAccessLeaveHrQueue(actor.authorization);

    if (!actor.employeeId && !canReviewHrInScope) {
      return [];
    }

    const assignedPendingStep = actor.employeeId
      ? {
          approvalSteps: {
            some: {
              status: 'PENDING' as const,
              approverId: actor.employeeId,
            },
          },
        }
      : null;
    const scopedHrQueue =
      (queue === 'hr' || queue === 'actionable') && canReviewHrInScope;

    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        isActive: true,
        status: {
          in: [
            LeaveRequestStatus.SUBMITTED,
            LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
          ],
        },
        ...this.employeeDomainScope.leaveRequestWhere(),
        ...(queue === 'manager' && actor.employeeId
          ? { employee: { managerId: actor.employeeId } }
          : {}),
        approvalTransaction: {
          status: 'PENDING',
          ...(scopedHrQueue ? {} : (assignedPendingStep ?? {})),
        },
      },
      include: leaveRequestViewInclude,
      orderBy: { submittedAt: 'asc' },
    });

    const decorated = await Promise.all(
      rows.map(async (row) => {
        const actorIsScopedLeaveHr = actor.employeeId
          ? await this.workforceApprovalResolver.isEmployeeScopedLeaveHrActor({
              actorEmployeeId: actor.employeeId,
              subjectEmployeeId: row.employeeId,
              companyId: row.employee.companyId,
              branchId: row.employee.branchId,
              companyGroupId: row.employee.company?.companyGroupId ?? null,
              actorPermissions: actor.authorization.permissions,
            })
          : false;

        return this.decorateLeaveRequest(row, actor, { actorIsScopedLeaveHr });
      }),
    );

    return decorated.filter((row) => {
      if (!row.approvalProgress?.canAct) return false;
      if (queue === 'manager') {
        return row.approvalProgress.stage === 'MANAGER_REVIEW';
      }
      if (queue === 'hr') {
        return row.approvalProgress.stage === 'HR_REVIEW';
      }
      return true;
    });
  }

  /**
   * @deprecated Prefer GET /leave-requests/pending-approvals
   */
  async getPendingApprovals(approverId: string, actor: AuthenticatedUser) {
    if (
      actor.employeeId &&
      actor.employeeId !== approverId &&
      !actor.authorization.isGlobal
    ) {
      throw new ForbiddenException(
        'Approver id must match the authenticated employee',
      );
    }

    const transactions = await this.prisma.approvalTransaction.findMany({
      where: {
        status: 'PENDING',
        entityType: 'LEAVE_REQUEST',
      },
      include: {
        workflow: true,
        requestedBy: true,
        approvalSteps: {
          orderBy: {
            stepNo: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return transactions.filter((transaction) => {
      const currentStep = transaction.approvalSteps.find(
        (step) => step.stepNo === transaction.currentStep,
      );

      return (
        currentStep?.approverId === approverId &&
        currentStep.status === 'PENDING'
      );
    });
  }

  async getEmployeeLeaveHistory(employeeId: string, limit = 10) {
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        isActive: true,
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        fromDate: 'desc',
      },
      take: limit,
    });
  }

  async getUpcomingLeave(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: LeaveRequestStatus.APPROVED,
        fromDate: {
          gte: new Date(),
        },
        isActive: true,
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        fromDate: 'asc',
      },
    });
  }

  async getPendingLeaveRequests(employeeId: string) {
    return this.prisma.leaveRequest.findMany({
      where: {
        employeeId,
        status: {
          in: [
            LeaveRequestStatus.SUBMITTED,
            LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
          ],
        },
        isActive: true,
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getLatestLeaveRequest(employeeId: string) {
    return this.prisma.leaveRequest.findFirst({
      where: {
        employeeId,
        isActive: true,
      },
      include: {
        leaveType: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  private async submitOnce(id: string, _actor: AuthenticatedUser) {
    void _actor;
    return this.prisma.$transaction(
      async (tx) => {
        await lockLeaveRequest(tx, id);
        const request = await tx.leaveRequest.findFirst({
          where: {
            id,
            isActive: true,
            ...this.employeeDomainScope.leaveRequestWhere(),
          },
          include: {
            employee: {
              include: {
                company: { select: { id: true, companyGroupId: true } },
              },
            },
            leaveType: true,
          },
        });

        if (!request) {
          throw new NotFoundException('Leave request not found');
        }

        if (request.status !== LeaveRequestStatus.DRAFT) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Only draft requests can be submitted',
          });
        }

        const calculation = await this.leavePolicyResolver.resolveCalculation({
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
          fromDate: request.fromDate,
          toDate: request.toDate,
          isHalfDay: request.isHalfDay,
          client: tx,
        });

        await this.assertNoOverlap({
          employeeId: request.employeeId,
          fromDate: request.fromDate,
          toDate: request.toDate,
          excludeId: id,
          client: tx,
        });

        const year = Number(calculation.fromCalendarDate.slice(0, 4));
        const leaveBalance = await tx.employeeLeaveBalance.findFirst({
          where: {
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            year,
            isActive: true,
          },
        });

        const requestedDays = calculation.requestedWorkingDays;
        const isCompOff =
          request.leaveType.category === LeaveTypeCategory.COMP_OFF;

        if (!leaveBalance) {
          if (isCompOff) {
            // Comp-off credits are the source of truth; leave balance may lag.
          } else {
            throw new NotFoundException({
              code: WorkforceErrorCode.LEAVE_BALANCE_NOT_FOUND,
              message: 'Leave balance not found',
            });
          }
        }

        if (leaveBalance) {
          const available = Number(leaveBalance.balance);
          const canGoNegative = isCompOff
            ? false
            : calculation.allowNegativeBalance;
          const minBalance = canGoNegative
            ? -(calculation.maximumNegativeBalance ?? 0)
            : 0;

          if (available - requestedDays < minBalance) {
            throw new ConflictException({
              code: isCompOff
                ? WorkforceTimeErrorCode.COMP_OFF_BALANCE_INSUFFICIENT
                : WorkforceErrorCode.LEAVE_BALANCE_INSUFFICIENT,
              message: 'Insufficient leave balance',
            });
          }
        }

        const workflow = await this.workforceApprovalResolver.resolveWorkflow(
          {
            workflowCode: WorkforceWorkflowCode.LEAVE_APPROVAL,
            companyId: request.employee.companyId,
          },
          tx,
        );
        const chain =
          await this.workforceApprovalResolver.resolveLeaveApprovalSteps(
            {
              companyId: request.employee.companyId,
              branchId: request.employee.branchId,
              companyGroupId: request.employee.company?.companyGroupId ?? null,
              subjectEmployeeId: request.employeeId,
              managerId: request.employee.managerId,
              workflowSteps: workflow.steps,
            },
            tx,
          );

        const transaction = await tx.approvalTransaction.create({
          data: {
            workflowId: workflow.id,
            entityType: 'LEAVE_REQUEST',
            entityId: request.id,
            requestedById: request.employeeId,
            currentStep: chain.currentStep,
            status: 'PENDING',
          },
        });

        for (const step of chain.steps) {
          await tx.approvalTransactionStep.create({
            data: {
              transactionId: transaction.id,
              stepNo: step.stepNo,
              approverId: step.approverId,
              status: step.status,
              action: step.status === 'SKIPPED' ? 'SKIPPED' : null,
              remarks:
                step.status === 'SKIPPED'
                  ? 'Reporting manager ineligible'
                  : null,
              actionDate: step.status === 'SKIPPED' ? new Date() : null,
            },
          });
        }

        const approvalTransactionId = transaction.id;

        if (isCompOff) {
          await this.compOffAllocationService.reserveForLeaveRequest({
            tx,
            companyId: request.employee.companyId,
            branchId: request.employee.branchId,
            employeeId: request.employeeId,
            leaveTypeId: request.leaveTypeId,
            leaveRequestId: request.id,
            requestedDays,
            asOfDate: request.fromDate,
          });
        }

        if (leaveBalance) {
          await this.leaveBalanceLedger.reserveRequest({
            tx,
            leaveBalance: {
              ...leaveBalance,
              employee: {
                companyId: request.employee.companyId,
                branchId: request.employee.branchId,
              },
            },
            effectiveDate: request.fromDate,
            referenceType: 'LEAVE_REQUEST_SUBMIT',
            referenceId: request.id,
            leaveRequestId: request.id,
            idempotencyKey: `LEAVE_REQUEST:${request.id}:RESERVATION`,
            pendingDelta: requestedDays,
            balanceDelta: -requestedDays,
          });
        }

        const transition = await tx.leaveRequest.updateMany({
          where: {
            id,
            status: LeaveRequestStatus.DRAFT,
          },
          data: {
            status: LeaveRequestStatus.SUBMITTED,
            requestedDays,
            ...(leaveBalance ? { leaveBalanceId: leaveBalance.id } : {}),
            submittedAt: new Date(),
            ...(approvalTransactionId ? { approvalTransactionId } : {}),
          },
        });

        if (transition.count !== 1) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Leave request state changed during submit',
          });
        }

        const updated = await tx.leaveRequest.findUniqueOrThrow({
          where: { id },
          include: leaveRequestViewInclude,
        });

        await this.auditService.log(
          'LeaveRequest',
          updated.id,
          'SUBMIT',
          { status: LeaveRequestStatus.DRAFT },
          {
            status: updated.status,
            requestedDays: Number(updated.requestedDays),
          },
          { tx },
        );

        const currentApproverId =
          chain.steps.find(
            (step) =>
              step.stepNo === chain.currentStep && step.status === 'PENDING',
          )?.approverId ?? null;

        await this.writeLeaveOutboxNotifications(tx, updated, [
          ...(currentApproverId
            ? [
                {
                  eventType: 'LEAVE_REQUEST_SUBMITTED' as const,
                  recipientEmployeeIds: [currentApproverId],
                  dedupeKeySuffix: `approver-step-${chain.currentStep}`,
                },
              ]
            : []),
          {
            eventType: 'LEAVE_REQUEST_SUBMITTED_REQUESTER' as const,
            recipientEmployeeIds: [updated.employeeId],
            dedupeKeySuffix: 'requester-submitted',
          },
        ]);

        return this.decorateLeaveRequest(updated);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  private async approveOnce(
    id: string,
    dto: ProcessLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLeaveRequest(tx, id);
        const request = await tx.leaveRequest.findFirst({
          where: {
            id,
            isActive: true,
            ...this.employeeDomainScope.leaveRequestWhere(),
          },
          include: {
            employee: {
              include: {
                company: { select: { id: true, companyGroupId: true } },
              },
            },
            approvalTransaction: {
              include: {
                approvalSteps: { orderBy: { stepNo: 'asc' } },
                workflow: {
                  include: { steps: { orderBy: { stepNo: 'asc' } } },
                },
              },
            },
            leaveBalance: true,
            leaveType: true,
          },
        });

        if (!request) {
          throw new NotFoundException('Leave request not found');
        }

        if (!isSubmittedLeaveStatus(request.status)) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Only submitted leave requests can be approved',
          });
        }

        if (actor.employeeId && actor.employeeId === request.employeeId) {
          throw new ForbiddenException({
            code: WorkforceErrorCode.LEAVE_SELF_APPROVAL_FORBIDDEN,
            message: 'Employees cannot approve their own leave requests',
          });
        }

        const transaction = request.approvalTransaction;
        if (transaction) {
          const currentStep = transaction.approvalSteps.find(
            (step) => step.stepNo === transaction.currentStep,
          );

          if (!currentStep) {
            throw new BadRequestException('Current approval step not found');
          }

          this.workforceApprovalResolver.assertCurrentStepActor(
            await this.leaveCurrentStepActorInput(request, currentStep, actor),
          );

          await tx.approvalTransactionStep.update({
            where: { id: currentStep.id },
            data: {
              status: 'APPROVED',
              action: 'APPROVED',
              remarks: dto.remarks,
              actionDate: new Date(),
              ...(actor.employeeId ? { approverId: actor.employeeId } : {}),
            },
          });

          const nextStep = transaction.approvalSteps.find(
            (step) =>
              step.stepNo > transaction.currentStep &&
              step.status === 'PENDING',
          );

          if (nextStep) {
            await tx.approvalTransaction.update({
              where: { id: transaction.id },
              data: { currentStep: nextStep.stepNo },
            });
            await this.auditService.log(
              'LeaveRequest',
              request.id,
              'APPROVE_STEP',
              { status: request.status, stepNo: currentStep.stepNo },
              {
                status: request.status,
                stepNo: nextStep.stepNo,
                remarks: dto.remarks ?? null,
              },
              { tx },
            );
            const moved = await tx.leaveRequest.findUniqueOrThrow({
              where: { id },
              include: leaveRequestViewInclude,
            });
            if (nextStep.approverId) {
              await this.writeLeaveOutboxNotifications(tx, moved, [
                {
                  eventType: 'LEAVE_REQUEST_SUBMITTED',
                  recipientEmployeeIds: [nextStep.approverId],
                  dedupeKeySuffix: `approver-step-${nextStep.stepNo}`,
                },
              ]);
            }
            return this.decorateLeaveRequest(moved, actor);
          }

          await tx.approvalTransaction.update({
            where: { id: transaction.id },
            data: {
              status: 'APPROVED',
              currentStep: transaction.approvalSteps.length,
            },
          });
        }

        if (!request.leaveBalanceId) {
          const isOptionalHoliday =
            request.leaveType.category === LeaveTypeCategory.OPTIONAL_HOLIDAY ||
            Boolean(request.optionalHolidayEventId);
          // Comp-off may rely solely on credit allocations.
          // Optional holidays use catalog allowance, not leave balance.
          if (!isOptionalHoliday) {
            const allocations = await tx.compOffAllocation.count({
              where: {
                leaveRequestId: request.id,
                status: 'RESERVED',
              },
            });
            if (allocations === 0) {
              throw new NotFoundException({
                code: WorkforceErrorCode.LEAVE_BALANCE_NOT_FOUND,
                message: 'Leave balance not found',
              });
            }
          }
        }

        const requestedDays = Number(request.requestedDays);
        if (request.leaveBalanceId) {
          const balance = await tx.employeeLeaveBalance.findUnique({
            where: { id: request.leaveBalanceId },
          });

          if (!balance || Number(balance.pending) < requestedDays) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
              message:
                'Leave balance pending days no longer match this request',
            });
          }

          await this.leaveBalanceLedger.consumeReservation({
            tx,
            leaveBalance: {
              ...balance,
              employee: {
                companyId: request.employee.companyId,
                branchId: request.employee.branchId,
              },
            },
            effectiveDate: request.fromDate,
            referenceType: 'LEAVE_REQUEST_APPROVE',
            referenceId: request.id,
            leaveRequestId: request.id,
            idempotencyKey: `LEAVE_REQUEST:${request.id}:CONSUMPTION`,
            pendingDelta: -requestedDays,
            usedDelta: requestedDays,
            balanceDelta: 0,
            createdByUserId: actor.id,
          });
        }

        await this.compOffAllocationService.consumeForLeaveRequest({
          tx,
          leaveRequestId: request.id,
        });

        const transition = await tx.leaveRequest.updateMany({
          where: {
            id,
            status: {
              in: [
                LeaveRequestStatus.SUBMITTED,
                LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
              ],
            },
          },
          data: {
            status: LeaveRequestStatus.APPROVED,
            approvedDays: request.requestedDays,
            approvedAt: new Date(),
            approvedByUserId: actor.id,
          },
        });

        if (transition.count !== 1) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Leave request state changed during approval',
          });
        }

        const updated = await tx.leaveRequest.findUniqueOrThrow({
          where: { id },
          include: leaveRequestViewInclude,
        });

        await this.auditService.log(
          'LeaveRequest',
          updated.id,
          'APPROVE',
          { status: LeaveRequestStatus.SUBMITTED },
          {
            status: updated.status,
            approvedDays: Number(updated.approvedDays),
            remarks: dto.remarks ?? null,
          },
          { tx },
        );

        await this.writeLeaveOutboxNotifications(tx, updated, [
          {
            eventType: 'LEAVE_REQUEST_APPROVED',
            recipientEmployeeIds: [updated.employeeId],
            dedupeKeySuffix: 'requester-approved',
          },
        ]);

        return this.decorateLeaveRequest(updated, actor);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  private async rejectOnce(
    id: string,
    dto: RejectLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLeaveRequest(tx, id);
        const request = await tx.leaveRequest.findFirst({
          where: {
            id,
            isActive: true,
            ...this.employeeDomainScope.leaveRequestWhere(),
          },
          include: {
            employee: {
              include: {
                company: { select: { id: true, companyGroupId: true } },
              },
            },
            approvalTransaction: {
              include: {
                approvalSteps: { orderBy: { stepNo: 'asc' } },
                workflow: {
                  include: { steps: { orderBy: { stepNo: 'asc' } } },
                },
              },
            },
            leaveType: true,
            leaveBalance: true,
          },
        });

        if (!request) {
          throw new NotFoundException('Leave request not found');
        }

        if (!isSubmittedLeaveStatus(request.status)) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Only submitted leave requests can be rejected',
          });
        }

        if (actor.employeeId && actor.employeeId === request.employeeId) {
          throw new ForbiddenException({
            code: WorkforceErrorCode.LEAVE_SELF_APPROVAL_FORBIDDEN,
            message: 'Employees cannot reject their own leave requests',
          });
        }

        if (!dto.remarks?.trim()) {
          throw new BadRequestException('Rejection reason is required');
        }

        if (request.approvalTransaction) {
          const currentStep = request.approvalTransaction.approvalSteps.find(
            (step) => step.stepNo === request.approvalTransaction!.currentStep,
          );

          if (!currentStep) {
            throw new BadRequestException('Current approval step not found');
          }

          this.workforceApprovalResolver.assertCurrentStepActor(
            await this.leaveCurrentStepActorInput(request, currentStep, actor),
          );

          await tx.approvalTransactionStep.update({
            where: { id: currentStep.id },
            data: {
              status: 'REJECTED',
              action: 'REJECTED',
              remarks: dto.remarks,
              actionDate: new Date(),
              ...(actor.employeeId ? { approverId: actor.employeeId } : {}),
            },
          });

          await tx.approvalTransaction.update({
            where: { id: request.approvalTransaction.id },
            data: { status: 'REJECTED' },
          });
        }

        if (request.leaveBalanceId) {
          const requestedDays = Number(request.requestedDays);
          const leaveBalance = await tx.employeeLeaveBalance.findUnique({
            where: { id: request.leaveBalanceId },
            include: { employee: true },
          });
          if (!leaveBalance) {
            throw new NotFoundException('Leave balance not found');
          }

          await this.leaveBalanceLedger.reverseRequest({
            tx,
            leaveBalance,
            effectiveDate: request.fromDate,
            referenceType: 'LEAVE_REQUEST_REJECT',
            referenceId: request.id,
            leaveRequestId: request.id,
            idempotencyKey: `LEAVE_REQUEST:${request.id}:REJECT_RELEASE`,
            pendingDelta: -requestedDays,
            balanceDelta: requestedDays,
            reason: dto.remarks,
            createdByUserId: actor.id,
          });
        }

        await this.compOffAllocationService.releaseForLeaveRequest({
          tx,
          leaveRequestId: request.id,
        });

        const transition = await tx.leaveRequest.updateMany({
          where: {
            id,
            status: {
              in: [
                LeaveRequestStatus.SUBMITTED,
                LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
              ],
            },
          },
          data: {
            status: LeaveRequestStatus.REJECTED,
            cancellationReason: dto.remarks,
            rejectedAt: new Date(),
            rejectedByUserId: actor.id,
          },
        });

        if (transition.count !== 1) {
          throw new ConflictException({
            code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
            message: 'Leave request state changed during rejection',
          });
        }

        const updated = await tx.leaveRequest.findUniqueOrThrow({
          where: { id },
          include: leaveRequestViewInclude,
        });

        await this.auditService.log(
          'LeaveRequest',
          updated.id,
          'REJECT',
          { status: LeaveRequestStatus.SUBMITTED },
          { status: updated.status },
          { tx },
        );

        await this.writeLeaveOutboxNotifications(tx, updated, [
          {
            eventType: 'LEAVE_REQUEST_REJECTED',
            recipientEmployeeIds: [updated.employeeId],
            dedupeKeySuffix: 'requester-rejected',
          },
        ]);

        return this.decorateLeaveRequest(updated, actor);
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  private async cancelOnce(
    id: string,
    dto: CancelLeaveRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockLeaveRequest(tx, id);
        const request = await tx.leaveRequest.findFirst({
          where: {
            id,
            isActive: true,
            ...this.employeeDomainScope.leaveRequestWhere(),
          },
          include: {
            employee: {
              include: {
                company: { select: { id: true, companyGroupId: true } },
              },
            },
          },
        });

        if (!request) {
          throw new NotFoundException('Leave request not found');
        }

        const isOwner =
          Boolean(actor.employeeId) && actor.employeeId === request.employeeId;
        const requestedDays = Number(request.requestedDays);

        const finishCancel = async () => {
          const updated = await tx.leaveRequest.findUniqueOrThrow({
            where: { id },
          });
          await this.auditService.log(
            'LeaveRequest',
            updated.id,
            'CANCEL',
            null,
            {
              status: updated.status,
              reason: dto.reason ?? null,
            },
            { tx },
          );
          return updated;
        };

        if (request.status === LeaveRequestStatus.DRAFT) {
          if (!isOwner && !actor.authorization.isGlobal) {
            // Managers/HR in scope may also cancel drafts for employees.
          }

          const transition = await tx.leaveRequest.updateMany({
            where: { id, status: LeaveRequestStatus.DRAFT },
            data: {
              status: LeaveRequestStatus.CANCELLED,
              isActive: false,
              cancellationReason: dto.reason,
              cancelledAt: new Date(),
              cancelledByUserId: actor.id,
            },
          });

          if (transition.count !== 1) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
              message: 'Leave request state changed during cancel',
            });
          }

          return finishCancel();
        }

        if (isSubmittedLeaveStatus(request.status)) {
          if (!isOwner && !actor.authorization.isGlobal) {
            // Scoped managers may cancel submitted requests.
          }

          if (request.leaveBalanceId) {
            const leaveBalance = await tx.employeeLeaveBalance.findUnique({
              where: { id: request.leaveBalanceId },
              include: { employee: true },
            });
            if (!leaveBalance) {
              throw new NotFoundException('Leave balance not found');
            }

            await this.leaveBalanceLedger.reverseRequest({
              tx,
              leaveBalance,
              effectiveDate: request.fromDate,
              referenceType: 'LEAVE_REQUEST_CANCEL_SUBMITTED',
              referenceId: request.id,
              leaveRequestId: request.id,
              idempotencyKey: `LEAVE_REQUEST:${request.id}:CANCEL_RELEASE`,
              pendingDelta: -requestedDays,
              balanceDelta: requestedDays,
              reason: dto.reason,
              createdByUserId: actor.id,
            });
          }

          await this.compOffAllocationService.releaseForLeaveRequest({
            tx,
            leaveRequestId: request.id,
          });

          const transition = await tx.leaveRequest.updateMany({
            where: {
              id,
              status: {
                in: [
                  LeaveRequestStatus.SUBMITTED,
                  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
                ],
              },
            },
            data: {
              status: LeaveRequestStatus.CANCELLED,
              isActive: false,
              cancellationReason: dto.reason,
              cancelledAt: new Date(),
              cancelledByUserId: actor.id,
            },
          });

          if (transition.count !== 1) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
              message: 'Leave request state changed during cancel',
            });
          }

          return finishCancel();
        }

        if (request.status === LeaveRequestStatus.APPROVED) {
          if (!dto.reason?.trim()) {
            throw new BadRequestException(
              'Cancellation reason is required for approved leave',
            );
          }

          if (isOwner) {
            throw new ForbiddenException(
              'Employees cannot cancel approved leave; ask a manager',
            );
          }

          if (request.leaveBalanceId) {
            const leaveBalance = await tx.employeeLeaveBalance.findUnique({
              where: { id: request.leaveBalanceId },
              include: { employee: true },
            });
            if (!leaveBalance) {
              throw new NotFoundException('Leave balance not found');
            }

            await this.leaveBalanceLedger.reverseRequest({
              tx,
              leaveBalance,
              effectiveDate: request.fromDate,
              referenceType: 'LEAVE_REQUEST_CANCEL_APPROVED',
              referenceId: request.id,
              leaveRequestId: request.id,
              idempotencyKey: `LEAVE_REQUEST:${request.id}:APPROVED_REVERSAL`,
              usedDelta: -requestedDays,
              balanceDelta: requestedDays,
              reason: dto.reason,
              createdByUserId: actor.id,
            });
          }

          await this.compOffAllocationService.releaseForLeaveRequest({
            tx,
            leaveRequestId: request.id,
            restoreConsumed: true,
            asOfDate: new Date(),
          });

          const transition = await tx.leaveRequest.updateMany({
            where: { id, status: LeaveRequestStatus.APPROVED },
            data: {
              status: LeaveRequestStatus.CANCELLED,
              isActive: false,
              cancellationReason: dto.reason,
              cancelledAt: new Date(),
              cancelledByUserId: actor.id,
            },
          });

          if (transition.count !== 1) {
            throw new ConflictException({
              code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
              message: 'Leave request state changed during cancel',
            });
          }

          return finishCancel();
        }

        throw new ConflictException({
          code: WorkforceErrorCode.LEAVE_STATE_CHANGED,
          message: `Leave request in status ${request.status} cannot be cancelled`,
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      },
    );
  }

  private async getCompletedApprovalsForActor(actor: AuthenticatedUser) {
    if (!actor.employeeId) {
      return [];
    }

    const rows = await this.prisma.leaveRequest.findMany({
      where: {
        isActive: true,
        ...this.employeeDomainScope.leaveRequestWhere(),
        approvalTransaction: {
          approvalSteps: {
            some: {
              approverId: actor.employeeId,
              status: { in: ['APPROVED', 'REJECTED'] },
            },
          },
        },
      },
      include: leaveRequestViewInclude,
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => this.decorateLeaveRequest(row, actor));
  }

  private async leaveCurrentStepActorInput(
    request: {
      employeeId: string;
      employee?: {
        companyId: string;
        branchId: string;
        company?: { companyGroupId: string | null } | null;
      } | null;
      approvalTransaction: {
        approvalSteps: Array<{
          stepNo: number;
          status: string;
          approverId: string | null;
        }>;
        workflow?: {
          steps: Array<{
            stepNo: number;
            approverType: string;
            approverRole: string | null;
          }>;
        } | null;
      } | null;
    },
    currentStep: {
      id: string;
      approverId: string | null;
      status: string;
      stepNo: number;
    },
    actor: AuthenticatedUser,
  ) {
    const steps = request.approvalTransaction?.approvalSteps ?? [];
    const workflowSteps = request.approvalTransaction?.workflow?.steps ?? [];
    const currentStepKind = classifyLeaveTransactionStep({
      stepNo: currentStep.stepNo,
      steps,
      workflowSteps,
    });
    const actorIsScopedLeaveHr =
      actor.employeeId &&
      request.employee &&
      currentStepKind === 'HR' &&
      currentStep.approverId !== actor.employeeId
        ? await this.workforceApprovalResolver.isEmployeeScopedLeaveHrActor({
            actorEmployeeId: actor.employeeId,
            subjectEmployeeId: request.employeeId,
            companyId: request.employee.companyId,
            branchId: request.employee.branchId,
            companyGroupId: request.employee.company?.companyGroupId ?? null,
            actorPermissions: actor.authorization.permissions,
          })
        : false;

    return {
      currentStep,
      actorEmployeeId: actor.employeeId,
      subjectEmployeeId: request.employeeId,
      currentStepKind,
      actorPermissions: actor.authorization.permissions,
      actorIsScopedLeaveHr,
      priorStepApproverIds: steps
        .filter(
          (step) =>
            step.stepNo < currentStep.stepNo &&
            (step.status === 'APPROVED' || step.status === 'SKIPPED'),
        )
        .map((step) => step.approverId),
    };
  }

  private decorateLeaveRequest<
    T extends Parameters<typeof buildLeaveApprovalProgress>[0],
  >(
    request: T,
    actor?: AuthenticatedUser,
    options?: { actorIsScopedLeaveHr?: boolean },
  ) {
    return {
      ...request,
      approvalProgress: buildLeaveApprovalProgress(request, actor, options),
    };
  }

  private async resolveRecipientUserIds(
    tx: Prisma.TransactionClient,
    employeeIds: Array<string | null | undefined>,
  ): Promise<string[]> {
    const uniqueEmployeeIds = [
      ...new Set(
        employeeIds.filter((employeeId): employeeId is string =>
          Boolean(employeeId),
        ),
      ),
    ];
    if (uniqueEmployeeIds.length === 0) {
      return [];
    }

    const users = await tx.user.findMany({
      where: {
        employeeId: { in: uniqueEmployeeIds },
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  private async writeLeaveOutboxNotifications(
    tx: Prisma.TransactionClient,
    request: {
      id: string;
      employeeId: string;
      status: string;
      employee?: {
        companyId?: string;
        branchId?: string;
        company?: { companyGroupId?: string | null } | null;
      } | null;
    },
    notifications: Array<{
      eventType:
        | 'LEAVE_REQUEST_SUBMITTED'
        | 'LEAVE_REQUEST_SUBMITTED_REQUESTER'
        | 'LEAVE_REQUEST_APPROVED'
        | 'LEAVE_REQUEST_REJECTED';
      recipientEmployeeIds: string[];
      dedupeKeySuffix: string;
    }>,
  ) {
    for (const notification of notifications) {
      const recipientUserIds = await this.resolveRecipientUserIds(
        tx,
        notification.recipientEmployeeIds,
      );
      if (recipientUserIds.length === 0) {
        continue;
      }

      await this.outboxWriter.write(tx, {
        aggregateType: 'LeaveRequest',
        aggregateId: request.id,
        eventType: WorkforceNotificationEventCode[notification.eventType],
        payload: {
          leaveRequestId: request.id,
          employeeId: request.employeeId,
          companyId: request.employee?.companyId,
          branchId: request.employee?.branchId,
          status: request.status,
          recipientUserIds,
        },
        dedupeKey: `leave-request:${request.id}:${notification.dedupeKeySuffix}`,
        companyGroupId: request.employee?.company?.companyGroupId ?? null,
        companyId: request.employee?.companyId ?? null,
        branchId: request.employee?.branchId ?? null,
      });
    }
  }

  private async assertNoOverlap(params: {
    employeeId: string;
    fromDate: Date;
    toDate: Date;
    excludeId?: string;
    client?: Prisma.TransactionClient;
  }) {
    const client = params.client ?? this.prisma;
    const overlap = await client.leaveRequest.findFirst({
      where: {
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        employeeId: params.employeeId,
        isActive: true,
        status: { in: [...LEAVE_OVERLAP_STATUSES] },
        AND: [
          { fromDate: { lte: params.toDate } },
          { toDate: { gte: params.fromDate } },
        ],
      },
      select: { id: true },
    });

    if (overlap) {
      throw new ConflictException({
        code: WorkforceErrorCode.LEAVE_OVERLAP,
        message: 'Overlapping leave request exists',
      });
    }
  }

  private async withSerializableRetry<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    let attempt = 0;
    let lastError: unknown;

    while (attempt < SERIALIZABLE_RETRY_LIMIT) {
      attempt += 1;
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (
          !isSerializationFailure(error) ||
          attempt >= SERIALIZABLE_RETRY_LIMIT
        ) {
          throw error;
        }
      }
    }

    throw lastError;
  }

  private async syncLeaveCalendarDays(
    tx: Prisma.TransactionClient,
    leaveRequestId: string,
    calculation: {
      runtimeDaySnapshots?: Array<{
        businessDate: string;
        runtimeDayId: string | null;
        dayPortion: string;
        chargedDays: number;
        calculationStatus: string;
      }>;
    },
  ) {
    await tx.leaveRequestCalendarDay.deleteMany({ where: { leaveRequestId } });
    const snapshots = calculation.runtimeDaySnapshots ?? [];
    for (const row of snapshots) {
      if (!row.runtimeDayId) continue;
      await tx.leaveRequestCalendarDay.create({
        data: {
          leaveRequestId,
          businessDate: new Date(`${row.businessDate}T00:00:00.000Z`),
          runtimeDayId: row.runtimeDayId,
          dayPortion: row.dayPortion as never,
          chargedDays: row.chargedDays,
          calculationStatus: row.calculationStatus,
        },
      });
    }
  }
}
