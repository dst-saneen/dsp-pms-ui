import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LeaveTypeCategory, Prisma } from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceWorkflowCode } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { AuditService } from '../audit/audit.service';
import {
  OptionalHolidayCatalogService,
  type OptionalHolidayCatalog,
} from '../business-calendar/optional-holiday-catalog.service';
import {
  LeaveRequestStatus,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
} from '../employee-leave/constants';
import { WorkforceNotificationEventCode } from '../notification/notification-event.catalog';
import { OutboxWriterService } from '../outbox/outbox-writer.service';
import { WorkforceApprovalResolverService } from '../workforce-approval/workforce-approval-resolver.service';
import {
  isSerializationFailure,
  LEAVE_OVERLAP_STATUSES,
  SERIALIZABLE_RETRY_LIMIT,
} from '../leave-request/leave-request.constants';

/** Leave rows that count toward the employee's optional-holiday year plan. */
const ACTIVE_OPTIONAL_HOLIDAY_STATUSES = [
  LeaveRequestStatus.SUBMITTED,
  LeaveRequestStatus.APPROVED,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
] as const;

@Injectable()
export class OptionalHolidaySelectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalogService: OptionalHolidayCatalogService,
    private readonly auditService: AuditService,
    private readonly outboxWriter: OutboxWriterService,
    private readonly workforceApprovalResolver: WorkforceApprovalResolverService,
  ) {}

  async getCatalog(
    actor: AuthenticatedUser,
    year?: number,
  ): Promise<OptionalHolidayCatalog> {
    const employeeId = this.requireEmployeeId(actor);
    const resolvedYear = year ?? new Date().getUTCFullYear();
    return this.catalogService.getCatalog({
      employeeId,
      year: resolvedYear,
    });
  }

  async updateSelections(
    actor: AuthenticatedUser,
    year: number,
    eventIds: string[],
  ): Promise<OptionalHolidayCatalog> {
    const employeeId = this.requireEmployeeId(actor);
    const desiredIds = [...new Set(eventIds)];

    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const employee = await tx.employee.findUnique({
            where: { id: employeeId },
            select: {
              id: true,
              isActive: true,
              companyId: true,
              branchId: true,
              managerId: true,
              company: { select: { id: true, companyGroupId: true } },
            },
          });
          if (!employee || !employee.isActive) {
            throw new NotFoundException('Employee not found');
          }

          const catalog = await this.catalogService.getCatalog({
            employeeId: employee.id,
            year,
            client: tx,
          });

          const byEventId = new Map(
            catalog.holidays.map((holiday) => [holiday.eventId, holiday]),
          );

          for (const eventId of desiredIds) {
            if (!byEventId.has(eventId)) {
              throw new BadRequestException({
                code: 'OPTIONAL_HOLIDAY_EVENT_INVALID',
                message:
                  'One or more event IDs are not eligible optional holidays for this employee and year',
              });
            }
          }

          const desiredDates = desiredIds.map(
            (eventId) => byEventId.get(eventId)!.date,
          );
          if (new Set(desiredDates).size !== desiredDates.length) {
            throw new BadRequestException({
              code: 'OPTIONAL_HOLIDAY_DUPLICATE_DATE',
              message:
                'Cannot select two optional holidays on the same calendar date',
            });
          }

          if (desiredIds.length > catalog.optionalAllowance) {
            throw new BadRequestException({
              code: WorkforceErrorCode.OPTIONAL_HOLIDAY_ALLOWANCE_EXCEEDED,
              message: `You may select at most ${catalog.optionalAllowance} optional holiday(s)`,
            });
          }

          const yearFrom = this.parseDate(`${year}-01-01`);
          const yearTo = this.parseDate(`${year}-12-31`);

          const existing = await tx.leaveRequest.findMany({
            where: {
              employeeId: employee.id,
              companyId: employee.companyId,
              optionalHolidayEventId: { not: null },
              isActive: true,
              status: { in: [...ACTIVE_OPTIONAL_HOLIDAY_STATUSES] },
              fromDate: { gte: yearFrom, lte: yearTo },
            },
            select: {
              id: true,
              status: true,
              optionalHolidayEventId: true,
              approvalTransactionId: true,
            },
          });

          const existingByEvent = new Map(
            existing
              .filter((row) => row.optionalHolidayEventId)
              .map((row) => [row.optionalHolidayEventId!, row]),
          );
          const existingIds = new Set(existingByEvent.keys());
          const desired = new Set(desiredIds);

          const toAdd = [...desired].filter((id) => !existingIds.has(id));
          const toRemove = [...existingIds].filter((id) => !desired.has(id));

          if (toAdd.length === 0 && toRemove.length === 0) {
            return catalog;
          }

          for (const eventId of [...toAdd, ...toRemove]) {
            const holiday = byEventId.get(eventId);
            if (holiday?.locked) {
              throw new BadRequestException({
                code: WorkforceErrorCode.OPTIONAL_HOLIDAY_SELECTION_LOCKED,
                message:
                  'Cannot add or remove a locked optional holiday; changes must be made before the holiday date',
              });
            }
            // Event missing from catalog (amended/republished calendar): allow
            // cancel on remove so employees are not stuck with orphan picks.
          }

          const policy = await tx.companyHolidayPolicy.findFirst({
            where: {
              companyId: employee.companyId,
              year,
              isActive: true,
            },
            include: {
              optionalHolidayLeaveType: {
                select: {
                  id: true,
                  category: true,
                  isActive: true,
                  requiresApproval: true,
                },
              },
            },
          });

          if (
            !policy ||
            !policy.optionalHolidayLeaveType.isActive ||
            policy.optionalHolidayLeaveType.category !==
              LeaveTypeCategory.OPTIONAL_HOLIDAY
          ) {
            throw new NotFoundException({
              code: 'LEAVE_TYPE_NOT_FOUND',
              message: 'Optional holiday leave type is not configured',
            });
          }

          const requiresApproval =
            policy.optionalHolidayLeaveType.requiresApproval;
          const now = new Date();

          // Option A: cancel removals first so swaps / orphan cleanup do not
          // trip "overlapping leave" against rows we are about to drop.
          for (const eventId of toRemove) {
            const row = existingByEvent.get(eventId)!;
            await tx.leaveRequest.update({
              where: { id: row.id },
              data: {
                status: LeaveRequestStatus.CANCELLED,
                isActive: false,
                cancellationReason: 'Optional holiday selection updated',
                cancelledAt: now,
                cancelledByUserId: actor.id,
              },
            });
            if (row.approvalTransactionId) {
              await tx.approvalTransaction.update({
                where: { id: row.approvalTransactionId },
                data: { status: 'CANCELLED' },
              });
            }
            await this.auditService.log(
              'LeaveRequest',
              row.id,
              'OPTIONAL_HOLIDAY_SELECTION_REMOVED',
              { status: row.status, optionalHolidayEventId: eventId },
              { status: LeaveRequestStatus.CANCELLED },
              { userId: actor.id, tx },
            );
          }

          for (const eventId of toAdd) {
            const holiday = byEventId.get(eventId)!;
            const day = this.parseDate(holiday.date);
            await this.assertNoOverlap({
              employeeId: employee.id,
              fromDate: day,
              toDate: day,
              client: tx,
            });
          }

          for (const eventId of toAdd) {
            const holiday = byEventId.get(eventId)!;
            const day = this.parseDate(holiday.date);
            try {
              if (requiresApproval) {
                await this.createPendingSelection({
                  tx,
                  actor,
                  employee,
                  leaveTypeId: policy.optionalHolidayLeaveTypeId,
                  eventId,
                  day,
                  now,
                });
              } else {
                await this.createAutoApprovedSelection({
                  tx,
                  actor,
                  employee,
                  leaveTypeId: policy.optionalHolidayLeaveTypeId,
                  eventId,
                  day,
                  now,
                });
              }
            } catch (error) {
              if (this.isUniqueViolation(error)) {
                throw new ConflictException({
                  code: WorkforceErrorCode.OPTIONAL_HOLIDAY_SELECTION_CONFLICT,
                  message:
                    'Optional holiday selection conflict; refresh and try again',
                });
              }
              throw error;
            }
          }

          const eventCode =
            WorkforceNotificationEventCode.OPTIONAL_HOLIDAY_SELECTION_UPDATED;
          const selectionFingerprint = [...desiredIds].sort().join(',');
          await this.outboxWriter.write(tx, {
            aggregateType: 'LeaveRequest',
            aggregateId: employee.id,
            eventType: eventCode,
            dedupeKey: `${eventCode}:${employee.id}:${year}:${selectionFingerprint}`,
            companyId: employee.companyId,
            branchId: employee.branchId,
            payload: {
              employeeId: employee.id,
              companyId: employee.companyId,
              branchId: employee.branchId,
              eventCode,
              recipientUserIds: [actor.id],
              requiresApproval,
            },
          });

          return this.catalogService.getCatalog({
            employeeId: employee.id,
            year,
            client: tx,
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 15_000,
        },
      ),
    );
  }

  private async createAutoApprovedSelection(params: {
    tx: Prisma.TransactionClient;
    actor: AuthenticatedUser;
    employee: {
      id: string;
      companyId: string;
      branchId: string | null;
    };
    leaveTypeId: string;
    eventId: string;
    day: Date;
    now: Date;
  }) {
    const created = await params.tx.leaveRequest.create({
      data: {
        companyId: params.employee.companyId,
        employeeId: params.employee.id,
        leaveTypeId: params.leaveTypeId,
        optionalHolidayEventId: params.eventId,
        fromDate: params.day,
        toDate: params.day,
        requestedDays: 1,
        approvedDays: 1,
        isHalfDay: false,
        status: LeaveRequestStatus.APPROVED,
        submittedAt: params.now,
        approvedAt: params.now,
        approvedByUserId: null,
        approvalTransactionId: null,
      },
    });
    await this.auditService.log(
      'LeaveRequest',
      created.id,
      'OPTIONAL_HOLIDAY_AUTO_APPROVED',
      null,
      {
        status: created.status,
        optionalHolidayEventId: params.eventId,
        requestedDays: 1,
        approvedDays: 1,
        approvalTransactionId: null,
      },
      { userId: params.actor.id, tx: params.tx },
    );
  }

  private async createPendingSelection(params: {
    tx: Prisma.TransactionClient;
    actor: AuthenticatedUser;
    employee: {
      id: string;
      companyId: string;
      branchId: string | null;
      managerId: string | null;
      company: { id: string; companyGroupId: string | null };
    };
    leaveTypeId: string;
    eventId: string;
    day: Date;
    now: Date;
  }) {
    const created = await params.tx.leaveRequest.create({
      data: {
        companyId: params.employee.companyId,
        employeeId: params.employee.id,
        leaveTypeId: params.leaveTypeId,
        optionalHolidayEventId: params.eventId,
        fromDate: params.day,
        toDate: params.day,
        requestedDays: 1,
        approvedDays: null,
        isHalfDay: false,
        status: LeaveRequestStatus.SUBMITTED,
        submittedAt: params.now,
        approvedAt: null,
        approvedByUserId: null,
        approvalTransactionId: null,
      },
    });

    const workflow = await this.workforceApprovalResolver.resolveWorkflow(
      {
        workflowCode: WorkforceWorkflowCode.LEAVE_APPROVAL,
        companyId: params.employee.companyId,
      },
      params.tx,
    );
    const chain =
      await this.workforceApprovalResolver.resolveLeaveApprovalSteps(
        {
          companyId: params.employee.companyId,
          branchId: params.employee.branchId ?? '',
          companyGroupId: params.employee.company.companyGroupId,
          subjectEmployeeId: params.employee.id,
          managerId: params.employee.managerId,
          workflowSteps: workflow.steps,
        },
        params.tx,
      );

    const transaction = await params.tx.approvalTransaction.create({
      data: {
        workflowId: workflow.id,
        entityType: 'LEAVE_REQUEST',
        entityId: created.id,
        requestedById: params.employee.id,
        currentStep: chain.currentStep,
        status: 'PENDING',
      },
    });

    for (const step of chain.steps) {
      await params.tx.approvalTransactionStep.create({
        data: {
          transactionId: transaction.id,
          stepNo: step.stepNo,
          approverId: step.approverId,
          status: step.status,
          action: step.status === 'SKIPPED' ? 'SKIPPED' : null,
          remarks:
            step.status === 'SKIPPED' ? 'Reporting manager ineligible' : null,
          actionDate: step.status === 'SKIPPED' ? params.now : null,
        },
      });
    }

    await params.tx.leaveRequest.update({
      where: { id: created.id },
      data: { approvalTransactionId: transaction.id },
    });

    await this.auditService.log(
      'LeaveRequest',
      created.id,
      'OPTIONAL_HOLIDAY_SUBMITTED',
      null,
      {
        status: LeaveRequestStatus.SUBMITTED,
        optionalHolidayEventId: params.eventId,
        requestedDays: 1,
        approvalTransactionId: transaction.id,
      },
      { userId: params.actor.id, tx: params.tx },
    );

    const firstPending = chain.steps.find(
      (step) => step.status === 'PENDING' && step.approverId,
    );
    if (firstPending?.approverId) {
      const recipients = await params.tx.user.findMany({
        where: {
          employeeId: firstPending.approverId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      const recipientUserIds = recipients.map((user) => user.id);
      if (recipientUserIds.length > 0) {
        await this.outboxWriter.write(params.tx, {
          aggregateType: 'LeaveRequest',
          aggregateId: created.id,
          eventType: WorkforceNotificationEventCode.LEAVE_REQUEST_SUBMITTED,
          dedupeKey: `leave-request:${created.id}:optional-holiday-approver`,
          companyId: params.employee.companyId,
          branchId: params.employee.branchId,
          companyGroupId: params.employee.company.companyGroupId,
          payload: {
            leaveRequestId: created.id,
            employeeId: params.employee.id,
            companyId: params.employee.companyId,
            branchId: params.employee.branchId,
            status: LeaveRequestStatus.SUBMITTED,
            recipientUserIds,
          },
        });
      }
    }
  }

  private requireEmployeeId(actor: AuthenticatedUser): string {
    if (!actor.employeeId) {
      throw new BadRequestException({
        code: WorkforceErrorCode.EMPLOYEE_LINK_REQUIRED,
        message: 'Authenticated user is not linked to an employee',
      });
    }
    return actor.employeeId;
  }

  private async assertNoOverlap(params: {
    employeeId: string;
    fromDate: Date;
    toDate: Date;
    client: Prisma.TransactionClient;
  }) {
    const overlap = await params.client.leaveRequest.findFirst({
      where: {
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

  private isUniqueViolation(error: unknown): boolean {
    return (
      !!error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    );
  }

  private parseDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}
