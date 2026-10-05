import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaveTypeCategory,
  OvertimeRequestStatus,
  OvertimeSettlementType,
  Prisma,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import {
  WorkforcePolicyDefaults,
  WorkforceWorkflowCode,
} from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { CompOffCreditService } from '../comp-off/comp-off-credit.service';
import { WorkforceApprovalResolverService } from '../workforce-approval/workforce-approval-resolver.service';
import { OvertimePolicyResolverService } from '../workforce-policy/overtime-policy-resolver.service';

import {
  ApproveOvertimeRequestDto,
  CancelOvertimeRequestDto,
  OvertimeRequestFilterDto,
  RejectOvertimeRequestDto,
  SubmitOvertimeRequestDto,
} from './dto';
import { calculateOvertimeEligibility } from './overtime-eligibility.util';

const ACTIVE_OVERTIME_STATUSES: OvertimeRequestStatus[] = [
  OvertimeRequestStatus.CALCULATED,
  OvertimeRequestStatus.SUBMITTED,
  OvertimeRequestStatus.APPROVED,
  OvertimeRequestStatus.SETTLED,
];

type PrismaTx = Prisma.TransactionClient;

@Injectable()
export class OvertimeRequestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly overtimePolicyResolver: OvertimePolicyResolverService,
    private readonly workforceApprovalResolver: WorkforceApprovalResolverService,
    private readonly compOffCreditService: CompOffCreditService,
  ) {}

  async findAll(filters: OvertimeRequestFilterDto) {
    const where: Prisma.OvertimeRequestWhereInput = {
      ...this.employeeDomainScope.overtimeRequestWhere(),
    };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.status) where.status = filters.status;
    if (filters.fromDate || filters.toDate) {
      where.businessDate = {};
      if (filters.fromDate) {
        where.businessDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.businessDate.lte = new Date(filters.toDate);
      }
    }

    return this.prisma.overtimeRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        attendance: true,
        compOffCredit: true,
      },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.overtimeRequest.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.overtimeRequestWhere(),
      },
      include: {
        attendance: true,
        employee: true,
        approvalTransaction: {
          include: { approvalSteps: { orderBy: { stepNo: 'asc' } } },
        },
        compOffCredit: true,
        overtimePolicy: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Overtime request not found');
    }
    return row;
  }

  async findMine(employeeId: string) {
    return this.prisma.overtimeRequest.findMany({
      where: {
        employeeId,
        ...this.employeeDomainScope.overtimeRequestWhere(),
      },
      include: { attendance: true, compOffCredit: true },
      orderBy: [{ businessDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Upsert a CALCULATED overtime row from an attendance snapshot.
   * Idempotent for retries: refreshes minutes while status remains CALCULATED.
   */
  async syncCalculatedFromAttendance(
    attendanceId: string,
    tx?: PrismaTx,
  ): Promise<{ id: string; eligibleMinutes: number } | null> {
    const client = tx ?? this.prisma;
    const attendance = await client.attendance.findFirst({
      where: { id: attendanceId, isActive: true },
      include: {
        employee: true,
      },
    });
    if (!attendance?.checkInTime || !attendance.checkOutTime) {
      return null;
    }

    const policy = await this.overtimePolicyResolver.resolve({
      companyId: attendance.employee.companyId,
      branchId: attendance.employee.branchId,
      asOfDate: attendance.attendanceDate,
    });

    const eligibility = calculateOvertimeEligibility({
      attendance: {
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        scheduledStartAt: attendance.scheduledStartAt,
        scheduledEndAt: attendance.scheduledEndAt,
        scheduledBreakMinutes: attendance.scheduledBreakMinutes,
        scheduledNetMinutes: attendance.scheduledNetMinutes,
        scheduleDayType: attendance.scheduleDayType,
      },
      policy,
    });

    const existing = await client.overtimeRequest.findFirst({
      where: {
        attendanceId,
        status: { in: ACTIVE_OVERTIME_STATUSES },
      },
    });

    if (existing) {
      if (existing.status === OvertimeRequestStatus.CALCULATED) {
        if (eligibility.eligibleMinutes <= 0) {
          await client.overtimeRequest.update({
            where: { id: existing.id },
            data: {
              status: OvertimeRequestStatus.CANCELLED,
              cancelledAt: new Date(),
              rawMinutes: eligibility.rawMinutes,
              eligibleMinutes: 0,
              requestedMinutes: 0,
              calculationSnapshot:
                eligibility.calculationSnapshot as Prisma.InputJsonValue,
            },
          });
          return null;
        }

        const updated = await client.overtimeRequest.update({
          where: { id: existing.id },
          data: {
            rawMinutes: eligibility.rawMinutes,
            eligibleMinutes: eligibility.eligibleMinutes,
            requestedMinutes: eligibility.eligibleMinutes,
            overtimePolicyId: policy.policyId,
            calculationSnapshot:
              eligibility.calculationSnapshot as Prisma.InputJsonValue,
          },
        });
        return {
          id: updated.id,
          eligibleMinutes: updated.eligibleMinutes,
        };
      }
      return {
        id: existing.id,
        eligibleMinutes: existing.eligibleMinutes,
      };
    }

    if (eligibility.eligibleMinutes <= 0) {
      return null;
    }

    const created = await client.overtimeRequest.create({
      data: {
        companyId: attendance.employee.companyId,
        branchId: attendance.employee.branchId,
        employeeId: attendance.employeeId,
        attendanceId: attendance.id,
        overtimePolicyId: policy.policyId,
        businessDate: attendance.attendanceDate,
        rawMinutes: eligibility.rawMinutes,
        eligibleMinutes: eligibility.eligibleMinutes,
        requestedMinutes: eligibility.eligibleMinutes,
        requestedSettlement: OvertimeSettlementType.COMP_OFF,
        status: OvertimeRequestStatus.CALCULATED,
        calculationSnapshot:
          eligibility.calculationSnapshot as Prisma.InputJsonValue,
      },
    });

    return {
      id: created.id,
      eligibleMinutes: created.eligibleMinutes,
    };
  }

  async submit(
    id: string,
    dto: SubmitOvertimeRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.overtimeRequest.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.overtimeRequestWhere(),
        },
        include: {
          employee: true,
          attendance: true,
        },
      });
      if (!request) {
        throw new NotFoundException('Overtime request not found');
      }
      if (request.status !== OvertimeRequestStatus.CALCULATED) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Only calculated overtime requests can be submitted',
        });
      }
      if (actor.employeeId && actor.employeeId !== request.employeeId) {
        throw new ForbiddenException('Cannot submit another employee overtime');
      }

      const eligibility = await this.recalculateEligibility(request, tx);
      if (eligibility.eligibleMinutes <= 0) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.OVERTIME_NOT_ELIGIBLE,
          message: 'Attendance is no longer eligible for overtime',
        });
      }

      const requestedMinutes = Math.min(
        dto.requestedMinutes,
        eligibility.eligibleMinutes,
      );
      if (requestedMinutes <= 0) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.OVERTIME_NOT_ELIGIBLE,
          message: 'Requested overtime minutes must be positive',
        });
      }

      this.assertSettlementAllowed(
        dto.requestedSettlement,
        eligibility.policy.allowCompOff,
        eligibility.policy.allowPayrollPending,
      );

      let approvalTransactionId: string | undefined;
      if (eligibility.policy.requiresApproval) {
        const workflow = await this.workforceApprovalResolver.resolveWorkflow(
          {
            workflowCode: WorkforceWorkflowCode.OVERTIME_APPROVAL,
            companyId: request.companyId,
          },
          tx,
        );

        if (workflow.steps.length > 0) {
          const transaction = await tx.approvalTransaction.create({
            data: {
              workflowId: workflow.id,
              entityType: 'OVERTIME_REQUEST',
              entityId: request.id,
              requestedById: request.employeeId,
              currentStep: 1,
              status: 'PENDING',
            },
          });

          for (const step of workflow.steps) {
            const approverId =
              await this.workforceApprovalResolver.resolveApproverEmployeeId(
                {
                  companyId: request.companyId,
                  subjectEmployeeId: request.employeeId,
                  managerId: request.employee.managerId,
                  step,
                },
                tx,
              );
            await tx.approvalTransactionStep.create({
              data: {
                transactionId: transaction.id,
                stepNo: step.stepNo,
                approverId,
                status: 'PENDING',
              },
            });
          }
          approvalTransactionId = transaction.id;
        }
      }

      const transition = await tx.overtimeRequest.updateMany({
        where: {
          id,
          status: OvertimeRequestStatus.CALCULATED,
        },
        data: {
          status: OvertimeRequestStatus.SUBMITTED,
          requestedSettlement: dto.requestedSettlement,
          requestedMinutes,
          rawMinutes: eligibility.rawMinutes,
          eligibleMinutes: eligibility.eligibleMinutes,
          overtimePolicyId: eligibility.policy.policyId,
          calculationSnapshot:
            eligibility.calculationSnapshot as Prisma.InputJsonValue,
          reason: dto.reason,
          submittedAt: new Date(),
          ...(approvalTransactionId ? { approvalTransactionId } : {}),
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Overtime request state changed during submit',
        });
      }

      const updated = await tx.overtimeRequest.findUniqueOrThrow({
        where: { id },
      });
      await this.auditService.log(
        'OvertimeRequest',
        updated.id,
        'SUBMIT',
        { status: OvertimeRequestStatus.CALCULATED },
        {
          status: updated.status,
          requestedMinutes: updated.requestedMinutes,
          requestedSettlement: updated.requestedSettlement,
        },
        { tx },
      );
      return updated;
    });
  }

  async approve(
    id: string,
    dto: ApproveOvertimeRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.overtimeRequest.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.overtimeRequestWhere(),
        },
        include: {
          employee: true,
          attendance: true,
          approvalTransaction: {
            include: { approvalSteps: { orderBy: { stepNo: 'asc' } } },
          },
        },
      });
      if (!request) {
        throw new NotFoundException('Overtime request not found');
      }
      if (request.status !== OvertimeRequestStatus.SUBMITTED) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Only submitted overtime requests can be approved',
        });
      }
      if (actor.employeeId && actor.employeeId === request.employeeId) {
        throw new ForbiddenException({
          code: WorkforceTimeErrorCode.SELF_APPROVAL_FORBIDDEN,
          message: 'Employees cannot approve their own overtime',
        });
      }

      const eligibility = await this.recalculateEligibility(request, tx);
      if (eligibility.eligibleMinutes <= 0) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.OVERTIME_NOT_ELIGIBLE,
          message: 'Attendance is no longer eligible for overtime',
        });
      }

      const approvedMinutes = Math.min(
        dto.approvedMinutes,
        eligibility.eligibleMinutes,
      );
      if (approvedMinutes <= 0) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.OVERTIME_NOT_ELIGIBLE,
          message: 'Approved overtime minutes must be positive',
        });
      }

      this.assertSettlementAllowed(
        dto.approvedSettlement,
        eligibility.policy.allowCompOff,
        eligibility.policy.allowPayrollPending,
      );

      if (
        dto.approvedSettlement === OvertimeSettlementType.COMP_OFF &&
        approvedMinutes >
          (eligibility.policy.compOffFullDayMinutes ??
            WorkforcePolicyDefaults.compOffFullDayMinutes)
      ) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.COMP_OFF_LIMIT_EXCEEDED,
          message:
            'Comp-off settlement cannot exceed the full-day minute cap; reduce minutes or choose Payroll Pending',
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
        this.workforceApprovalResolver.assertCurrentStepActor({
          currentStep,
          actorEmployeeId: actor.employeeId,
          subjectEmployeeId: request.employeeId,
          actorPermissions: actor.authorization.permissions,
          actorCanOverrideAsApprover: this.canOverrideOvertimeApprover(actor),
        });

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
          (step) => step.stepNo === transaction.currentStep + 1,
        );
        if (nextStep) {
          await tx.approvalTransaction.update({
            where: { id: transaction.id },
            data: { currentStep: transaction.currentStep + 1 },
          });
          return {
            success: true,
            message: 'Moved to next approval step',
            partial: true,
          };
        }

        await tx.approvalTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'APPROVED',
            currentStep: transaction.approvalSteps.length,
          },
        });
      }

      const transition = await tx.overtimeRequest.updateMany({
        where: { id, status: OvertimeRequestStatus.SUBMITTED },
        data: {
          status: OvertimeRequestStatus.APPROVED,
          approvedMinutes,
          approvedSettlement: dto.approvedSettlement,
          rawMinutes: eligibility.rawMinutes,
          eligibleMinutes: eligibility.eligibleMinutes,
          overtimePolicyId: eligibility.policy.policyId,
          calculationSnapshot:
            eligibility.calculationSnapshot as Prisma.InputJsonValue,
          approvedAt: new Date(),
          approvedByUserId: actor.id,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Overtime request state changed during approval',
        });
      }

      await this.settleApproved(id, actor, tx);

      const updated = await tx.overtimeRequest.findUniqueOrThrow({
        where: { id },
        include: { compOffCredit: true },
      });
      await this.auditService.log(
        'OvertimeRequest',
        updated.id,
        'APPROVE',
        { status: OvertimeRequestStatus.SUBMITTED },
        {
          status: updated.status,
          approvedMinutes: updated.approvedMinutes,
          approvedSettlement: updated.approvedSettlement,
        },
        { tx },
      );
      return updated;
    });
  }

  async reject(
    id: string,
    dto: RejectOvertimeRequestDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.remarks?.trim()) {
      throw new BadRequestException('Rejection reason is required');
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.overtimeRequest.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.overtimeRequestWhere(),
        },
        include: {
          approvalTransaction: {
            include: { approvalSteps: { orderBy: { stepNo: 'asc' } } },
          },
        },
      });
      if (!request) {
        throw new NotFoundException('Overtime request not found');
      }
      if (request.status !== OvertimeRequestStatus.SUBMITTED) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Only submitted overtime requests can be rejected',
        });
      }
      if (actor.employeeId && actor.employeeId === request.employeeId) {
        throw new ForbiddenException({
          code: WorkforceTimeErrorCode.SELF_APPROVAL_FORBIDDEN,
          message: 'Employees cannot reject their own overtime',
        });
      }

      if (request.approvalTransaction) {
        const currentStep = request.approvalTransaction.approvalSteps.find(
          (step) => step.stepNo === request.approvalTransaction!.currentStep,
        );
        if (!currentStep) {
          throw new BadRequestException('Current approval step not found');
        }
        this.workforceApprovalResolver.assertCurrentStepActor({
          currentStep,
          actorEmployeeId: actor.employeeId,
          subjectEmployeeId: request.employeeId,
          actorPermissions: actor.authorization.permissions,
          actorCanOverrideAsApprover: this.canOverrideOvertimeApprover(actor),
        });
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

      const transition = await tx.overtimeRequest.updateMany({
        where: { id, status: OvertimeRequestStatus.SUBMITTED },
        data: {
          status: OvertimeRequestStatus.REJECTED,
          rejectedAt: new Date(),
          rejectedByUserId: actor.id,
          reason: dto.remarks,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Overtime request state changed during rejection',
        });
      }

      const updated = await tx.overtimeRequest.findUniqueOrThrow({
        where: { id },
      });
      await this.auditService.log(
        'OvertimeRequest',
        updated.id,
        'REJECT',
        { status: OvertimeRequestStatus.SUBMITTED },
        { status: updated.status },
        { tx },
      );
      return updated;
    });
  }

  async cancel(
    id: string,
    dto: CancelOvertimeRequestDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.overtimeRequest.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.overtimeRequestWhere(),
        },
      });
      if (!request) {
        throw new NotFoundException('Overtime request not found');
      }

      const cancellable: OvertimeRequestStatus[] = [
        OvertimeRequestStatus.CALCULATED,
        OvertimeRequestStatus.SUBMITTED,
      ];
      if (!cancellable.includes(request.status)) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: `Overtime request in status ${request.status} cannot be cancelled`,
        });
      }

      if (
        actor.employeeId &&
        actor.employeeId !== request.employeeId &&
        !actor.authorization.isGlobal
      ) {
        // Scoped managers/HR may cancel within tenant scope already filtered.
      }

      const transition = await tx.overtimeRequest.updateMany({
        where: {
          id,
          status: { in: cancellable },
        },
        data: {
          status: OvertimeRequestStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledByUserId: actor.id,
          reason: dto.reason ?? request.reason,
        },
      });
      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Overtime request state changed during cancel',
        });
      }

      const updated = await tx.overtimeRequest.findUniqueOrThrow({
        where: { id },
      });
      await this.auditService.log(
        'OvertimeRequest',
        updated.id,
        'CANCEL',
        null,
        { status: updated.status, reason: dto.reason ?? null },
        { tx },
      );
      return updated;
    });
  }

  private async settleApproved(
    id: string,
    actor: AuthenticatedUser,
    tx: PrismaTx,
  ) {
    const request = await tx.overtimeRequest.findUniqueOrThrow({
      where: { id },
    });

    if (
      request.approvedSettlement === OvertimeSettlementType.COMP_OFF &&
      request.approvedMinutes != null
    ) {
      await this.compOffCreditService.createFromOvertimeApproval(
        {
          overtimeRequestId: request.id,
          companyId: request.companyId,
          branchId: request.branchId,
          employeeId: request.employeeId,
          sourceDate: request.businessDate,
          approvedMinutes: request.approvedMinutes,
          createdByUserId: actor.id,
        },
        tx,
      );
    }

    // PAYROLL_PENDING: preserve approved minutes without monetary calc.
    await tx.overtimeRequest.update({
      where: { id },
      data: {
        status: OvertimeRequestStatus.SETTLED,
        settledAt: new Date(),
      },
    });
  }

  private async recalculateEligibility(
    request: {
      attendanceId: string;
      companyId: string;
      branchId: string;
      businessDate: Date;
      attendance: {
        checkInTime: Date | null;
        checkOutTime: Date | null;
        scheduledStartAt: Date | null;
        scheduledEndAt: Date | null;
        scheduledBreakMinutes: number | null;
        scheduledNetMinutes: number | null;
        scheduleDayType: import('@prisma/client').ShiftRosterDayType | null;
        attendanceDate: Date;
      };
    },
    _tx: PrismaTx,
  ) {
    void _tx;
    if (!request.attendance.checkInTime || !request.attendance.checkOutTime) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.OVERTIME_NOT_ELIGIBLE,
        message: 'Attendance must be checked out to calculate overtime',
      });
    }

    const policy = await this.overtimePolicyResolver.resolve({
      companyId: request.companyId,
      branchId: request.branchId,
      asOfDate: request.businessDate,
    });

    const eligibility = calculateOvertimeEligibility({
      attendance: {
        checkInTime: request.attendance.checkInTime,
        checkOutTime: request.attendance.checkOutTime,
        scheduledStartAt: request.attendance.scheduledStartAt,
        scheduledEndAt: request.attendance.scheduledEndAt,
        scheduledBreakMinutes: request.attendance.scheduledBreakMinutes,
        scheduledNetMinutes: request.attendance.scheduledNetMinutes,
        scheduleDayType: request.attendance.scheduleDayType,
      },
      policy,
    });

    return { ...eligibility, policy };
  }

  private assertSettlementAllowed(
    settlement: OvertimeSettlementType,
    allowCompOff: boolean,
    allowPayrollPending: boolean,
  ) {
    if (settlement === OvertimeSettlementType.COMP_OFF && !allowCompOff) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.OVERTIME_SETTLEMENT_INVALID,
        message: 'Comp-off settlement is not allowed by policy',
      });
    }
    if (
      settlement === OvertimeSettlementType.PAYROLL_PENDING &&
      !allowPayrollPending
    ) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.OVERTIME_SETTLEMENT_INVALID,
        message: 'Payroll Pending settlement is not allowed by policy',
      });
    }
  }

  /** HR overtime approvers may decide the queue even if snapshotted to manager. */
  private canOverrideOvertimeApprover(actor: AuthenticatedUser): boolean {
    const permissions = actor.authorization?.permissions ?? [];
    return (
      permissions.includes('hr.overtime.approve') ||
      permissions.includes('hr.overtime.manage')
    );
  }

  /** Used by leave integration to identify COMP_OFF leave types. */
  isCompOffLeaveCategory(category: LeaveTypeCategory): boolean {
    return category === LeaveTypeCategory.COMP_OFF;
  }
}
