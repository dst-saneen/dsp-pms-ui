import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceExceptionStatus,
  AttendanceRegularizationStatus,
  Prisma,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { WorkforceWorkflowCode } from '../../common/constants/workforce-time-contracts';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { WorkforceApprovalResolverService } from '../workforce-approval/workforce-approval-resolver.service';
import { AttendancePolicyResolverService } from '../workforce-policy/attendance-policy-resolver.service';

import { AttendanceExceptionService } from './attendance-exception.service';
import { AttendanceService } from './attendance.service';
import { BranchTimeService } from './branch-time.service';
import {
  CreateAttendanceRegularizationDto,
  ProcessAttendanceRegularizationDto,
} from './dto/attendance-workforce.dto';
import { toCalendarDate } from './attendance-calendar.util';

@Injectable()
export class AttendanceRegularizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly attendanceService: AttendanceService,
    private readonly attendanceExceptionService: AttendanceExceptionService,
    private readonly attendancePolicyResolver: AttendancePolicyResolverService,
    private readonly workforceApprovalResolver: WorkforceApprovalResolverService,
    private readonly branchTime: BranchTimeService,
  ) {}

  async findAll(filters: { employeeId?: string; status?: string }) {
    const where: Prisma.AttendanceRegularizationWhereInput = {
      ...this.employeeDomainScope.attendanceRegularizationWhere(),
    };
    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }
    if (filters.status) {
      where.status = filters.status as AttendanceRegularizationStatus;
    }

    return this.prisma.attendanceRegularization.findMany({
      where,
      include: {
        attendance: true,
        attendanceException: true,
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const row = await this.prisma.attendanceRegularization.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.attendanceRegularizationWhere(),
      },
      include: {
        attendance: true,
        attendanceException: true,
        approvalTransaction: {
          include: { approvalSteps: { orderBy: { stepNo: 'asc' } } },
        },
      },
    });
    if (!row) {
      throw new NotFoundException('Attendance regularization not found');
    }
    return row;
  }

  async submit(
    dto: CreateAttendanceRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.proposedCheckInAt && !dto.proposedCheckOutAt) {
      throw new BadRequestException(
        'At least one of proposedCheckInAt or proposedCheckOutAt is required',
      );
    }

    const attendance = await this.attendanceService.findOne(dto.attendanceId);
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: attendance.employeeId,
        ...this.employeeDomainScope.employeeWhere(),
      },
      include: { branch: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    await this.attendanceService.assertPeriodNotLocked(
      employee.branchId,
      employee.companyId,
      attendance.attendanceDate,
    );

    const policy = await this.attendancePolicyResolver.resolve({
      companyId: employee.companyId,
      branchId: employee.branchId,
      asOfDate: attendance.attendanceDate,
    });

    const timezone = this.branchTime.requireTimezone(employee.branch.timezone);
    const today = this.branchTime.businessDate(new Date(), timezone);
    const businessDate = toCalendarDate(attendance.attendanceDate, 'UTC');
    const windowEnd = this.addCalendarDays(
      businessDate,
      policy.regularizationWindowDays,
    );
    if (today > windowEnd) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.REGULARIZATION_WINDOW_EXPIRED,
        message: `Regularization window of ${policy.regularizationWindowDays} calendar days has expired`,
      });
    }

    if (
      actor.employeeId &&
      actor.employeeId !== attendance.employeeId &&
      !actor.authorization.permissions.includes('hr.attendance.regularize') &&
      !actor.authorization.permissions.includes('hr.attendance.manage')
    ) {
      throw new ForbiddenException('Cannot regularize another employee');
    }

    return this.prisma.$transaction(async (tx) => {
      const existingSubmitted = await tx.attendanceRegularization.findFirst({
        where: {
          attendanceId: attendance.id,
          status: AttendanceRegularizationStatus.SUBMITTED,
        },
      });
      if (existingSubmitted) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message:
            'A submitted regularization already exists for this attendance',
        });
      }

      if (dto.attendanceExceptionId) {
        const exception = await tx.attendanceException.findFirst({
          where: {
            id: dto.attendanceExceptionId,
            attendanceId: attendance.id,
          },
        });
        if (!exception) {
          throw new NotFoundException('Attendance exception not found');
        }
        if (exception.status !== AttendanceExceptionStatus.OPEN) {
          throw new ConflictException({
            code: WorkforceTimeErrorCode.ATTENDANCE_EXCEPTION_NOT_OPEN,
            message: 'Only open exceptions can be regularized',
          });
        }
      }

      const created = await tx.attendanceRegularization.create({
        data: {
          companyId: employee.companyId,
          branchId: employee.branchId,
          employeeId: attendance.employeeId,
          attendanceId: attendance.id,
          attendanceExceptionId: dto.attendanceExceptionId ?? null,
          proposedCheckInAt: dto.proposedCheckInAt
            ? new Date(dto.proposedCheckInAt)
            : null,
          proposedCheckOutAt: dto.proposedCheckOutAt
            ? new Date(dto.proposedCheckOutAt)
            : null,
          reason: dto.reason.trim(),
          status: AttendanceRegularizationStatus.SUBMITTED,
          requestedByUserId: actor.id,
          submittedAt: new Date(),
        },
      });

      if (dto.attendanceExceptionId) {
        await tx.attendanceException.update({
          where: { id: dto.attendanceExceptionId },
          data: { status: AttendanceExceptionStatus.SUBMITTED },
        });
      }

      const workflow = await this.workforceApprovalResolver.resolveWorkflow(
        {
          workflowCode: WorkforceWorkflowCode.ATTENDANCE_REGULARIZATION,
          companyId: employee.companyId,
        },
        tx,
      );

      if (workflow.steps.length > 0) {
        const transaction = await tx.approvalTransaction.create({
          data: {
            workflowId: workflow.id,
            entityType: 'ATTENDANCE_REGULARIZATION',
            entityId: created.id,
            requestedById: attendance.employeeId,
            currentStep: 1,
            status: 'PENDING',
          },
        });

        for (const step of workflow.steps) {
          const approverId =
            await this.workforceApprovalResolver.resolveApproverEmployeeId(
              {
                companyId: employee.companyId,
                subjectEmployeeId: attendance.employeeId,
                managerId: employee.managerId,
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

        await tx.attendanceRegularization.update({
          where: { id: created.id },
          data: { approvalTransactionId: transaction.id },
        });
      }

      await this.auditService.log(
        'AttendanceRegularization',
        created.id,
        'SUBMIT',
        null,
        { attendanceId: attendance.id, status: created.status },
        { tx },
      );

      return tx.attendanceRegularization.findUniqueOrThrow({
        where: { id: created.id },
        include: { attendance: true, attendanceException: true },
      });
    });
  }

  async approve(
    id: string,
    dto: ProcessAttendanceRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    return this.decide(id, 'APPROVE', dto, actor);
  }

  async reject(
    id: string,
    dto: ProcessAttendanceRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.remarks?.trim()) {
      throw new BadRequestException('Rejection remarks are required');
    }
    return this.decide(id, 'REJECT', dto, actor);
  }

  async cancel(id: string, actor: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.attendanceRegularization.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.attendanceRegularizationWhere(),
        },
      });
      if (!row) {
        throw new NotFoundException('Attendance regularization not found');
      }
      if (row.status !== AttendanceRegularizationStatus.SUBMITTED) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Only submitted regularizations can be cancelled',
        });
      }
      if (actor.employeeId && actor.employeeId !== row.employeeId) {
        const canManage =
          actor.authorization.permissions.includes(
            'hr.attendance.regularize',
          ) || actor.authorization.permissions.includes('hr.attendance.manage');
        if (!canManage) {
          throw new ForbiddenException('Only the requester can cancel');
        }
      }

      const updated = await tx.attendanceRegularization.update({
        where: { id },
        data: { status: AttendanceRegularizationStatus.CANCELLED },
      });

      if (row.attendanceExceptionId) {
        const exception = await tx.attendanceException.findUnique({
          where: { id: row.attendanceExceptionId },
          select: { status: true },
        });
        // Do not reopen exceptions already resolved by Correct / other paths.
        if (
          exception &&
          (exception.status === AttendanceExceptionStatus.OPEN ||
            exception.status === AttendanceExceptionStatus.SUBMITTED)
        ) {
          await tx.attendanceException.update({
            where: { id: row.attendanceExceptionId },
            data: { status: AttendanceExceptionStatus.OPEN },
          });
        }
      }

      if (row.approvalTransactionId) {
        await tx.approvalTransaction.update({
          where: { id: row.approvalTransactionId },
          data: { status: 'CANCELLED' },
        });
      }

      await this.auditService.log(
        'AttendanceRegularization',
        id,
        'CANCEL',
        { status: row.status },
        { status: updated.status },
        { tx },
      );

      return updated;
    });
  }

  private async decide(
    id: string,
    action: 'APPROVE' | 'REJECT',
    dto: ProcessAttendanceRegularizationDto,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.attendanceRegularization.findFirst({
        where: {
          id,
          ...this.employeeDomainScope.attendanceRegularizationWhere(),
        },
        include: {
          attendance: true,
          approvalTransaction: {
            include: { approvalSteps: { orderBy: { stepNo: 'asc' } } },
          },
        },
      });

      if (!row) {
        throw new NotFoundException('Attendance regularization not found');
      }
      if (row.status !== AttendanceRegularizationStatus.SUBMITTED) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Regularization is no longer submitted',
        });
      }

      await this.attendanceService.assertPeriodNotLocked(
        row.branchId,
        row.companyId,
        row.attendance.attendanceDate,
      );

      if (row.approvalTransaction) {
        const currentStep = row.approvalTransaction.approvalSteps.find(
          (step) => step.stepNo === row.approvalTransaction!.currentStep,
        );
        if (!currentStep) {
          throw new BadRequestException('Current approval step not found');
        }
        this.workforceApprovalResolver.assertCurrentStepActor({
          currentStep,
          actorEmployeeId: actor.employeeId,
          subjectEmployeeId: row.employeeId,
        });

        await tx.approvalTransactionStep.update({
          where: { id: currentStep.id },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            action: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            remarks: dto.remarks,
            actionDate: new Date(),
          },
        });

        await tx.approvalTransaction.update({
          where: { id: row.approvalTransaction.id },
          data: {
            status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          },
        });
      } else if (actor.employeeId && actor.employeeId === row.employeeId) {
        throw new ForbiddenException({
          code: WorkforceTimeErrorCode.SELF_APPROVAL_FORBIDDEN,
          message: 'Cannot approve own regularization',
        });
      }

      if (action === 'APPROVE') {
        await tx.attendance.update({
          where: { id: row.attendanceId },
          data: {
            checkInTime: row.proposedCheckInAt ?? row.attendance.checkInTime,
            checkOutTime: row.proposedCheckOutAt ?? row.attendance.checkOutTime,
            lastModifiedByUserId: actor.id,
            lastModifiedAt: new Date(),
            remarks: [
              row.attendance.remarks,
              `[REGULARIZATION ${id}] ${row.reason}`,
            ]
              .filter(Boolean)
              .join(' | '),
          },
        });

        await this.attendanceExceptionService.resolveForAttendance(
          row.attendanceId,
          'REGULARIZATION_APPROVED',
          actor.id,
          tx,
        );

        if (row.attendanceExceptionId) {
          await tx.attendanceException.update({
            where: { id: row.attendanceExceptionId },
            data: {
              status: AttendanceExceptionStatus.APPROVED,
              resolvedAt: new Date(),
              resolvedByUserId: actor.id,
              resolutionCode: 'REGULARIZATION_APPROVED',
            },
          });
        }
      } else if (row.attendanceExceptionId) {
        await tx.attendanceException.update({
          where: { id: row.attendanceExceptionId },
          data: {
            status: AttendanceExceptionStatus.REJECTED,
            resolvedAt: new Date(),
            resolvedByUserId: actor.id,
            resolutionCode: 'REGULARIZATION_REJECTED',
          },
        });
      }

      const updated = await tx.attendanceRegularization.update({
        where: { id },
        data: {
          status:
            action === 'APPROVE'
              ? AttendanceRegularizationStatus.APPROVED
              : AttendanceRegularizationStatus.REJECTED,
          reviewedByUserId: actor.id,
          reviewedAt: new Date(),
          reviewerRemarks: dto.remarks ?? null,
        },
      });

      await this.auditService.log(
        'AttendanceRegularization',
        id,
        action,
        { status: row.status },
        { status: updated.status },
        { tx },
      );

      return updated;
    });
  }

  private addCalendarDays(calendarDate: string, days: number): string {
    const [y, m, d] = calendarDate.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return next.toISOString().slice(0, 10);
  }
}
