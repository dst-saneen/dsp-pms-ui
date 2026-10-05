import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttendanceExceptionStatus,
  AttendanceExceptionType,
  AttendancePeriodStatus,
  AttendanceRegularizationStatus,
  Prisma,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { calendarDateToUtcMidnight } from './attendance-calendar.util';
import {
  AttendancePeriodFilterDto,
  AttendancePeriodTransitionDto,
  CreateAttendancePeriodDto,
} from './dto/attendance-workforce.dto';

@Injectable()
export class AttendancePeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateAttendancePeriodDto, actor: AuthenticatedUser) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        ...this.employeeDomainScope.branchWhere(),
      },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const periodStart = calendarDateToUtcMidnight(
      `${dto.periodYear}-${String(dto.periodMonth).padStart(2, '0')}-01`,
    );
    const periodEnd = new Date(
      Date.UTC(dto.periodYear, dto.periodMonth, 0, 0, 0, 0),
    );

    try {
      const created = await this.prisma.attendancePeriod.create({
        data: {
          companyId: branch.companyId,
          branchId: branch.id,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          periodStart,
          periodEnd,
          status: AttendancePeriodStatus.OPEN,
        },
      });

      await this.auditService.log(
        'AttendancePeriod',
        created.id,
        'CREATE',
        null,
        {
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          actorUserId: actor.id,
        },
      );

      return created;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: 'Attendance period already exists for this branch/month',
        });
      }
      throw error;
    }
  }

  async findAll(filters: AttendancePeriodFilterDto) {
    const where: Prisma.AttendancePeriodWhereInput = {
      ...this.employeeDomainScope.attendancePeriodWhere(),
    };
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.companyId) where.companyId = filters.companyId;
    if (filters.status) {
      where.status = filters.status as AttendancePeriodStatus;
    }

    return this.prisma.attendancePeriod.findMany({
      where,
      include: {
        branch: { select: { id: true, branchCode: true, branchName: true } },
        company: { select: { id: true, companyCode: true, companyName: true } },
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    });
  }

  async findOne(id: string) {
    const period = await this.prisma.attendancePeriod.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.attendancePeriodWhere(),
      },
    });
    if (!period) {
      throw new NotFoundException('Attendance period not found');
    }
    return period;
  }

  async review(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
  ) {
    return this.transition(
      id,
      dto,
      actor,
      AttendancePeriodStatus.OPEN,
      AttendancePeriodStatus.REVIEW,
      'REVIEW',
      { reviewedByUserId: actor.id, reviewedAt: new Date() },
    );
  }

  async lock(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
  ) {
    await this.assertNoLockBlockers(id);
    return this.transition(
      id,
      dto,
      actor,
      AttendancePeriodStatus.REVIEW,
      AttendancePeriodStatus.LOCKED,
      'LOCK',
      { lockedByUserId: actor.id, lockedAt: new Date() },
    );
  }

  async markPayrollPending(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
  ) {
    return this.transition(
      id,
      dto,
      actor,
      AttendancePeriodStatus.LOCKED,
      AttendancePeriodStatus.PAYROLL_PENDING,
      'MARK_PAYROLL_PENDING',
      {
        payrollPendingByUserId: actor.id,
        payrollPendingAt: new Date(),
      },
    );
  }

  async close(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
  ) {
    return this.transition(
      id,
      dto,
      actor,
      AttendancePeriodStatus.PAYROLL_PENDING,
      AttendancePeriodStatus.CLOSED,
      'CLOSE',
      { closedByUserId: actor.id, closedAt: new Date() },
    );
  }

  async reopen(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
  ) {
    if (!dto.reopenReason?.trim()) {
      throw new BadRequestException('reopenReason is required');
    }

    const period = await this.findOne(id);
    if (
      period.status !== AttendancePeriodStatus.LOCKED &&
      period.status !== AttendancePeriodStatus.PAYROLL_PENDING &&
      period.status !== AttendancePeriodStatus.CLOSED
    ) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Only locked/payroll/closed periods can be reopened',
      });
    }

    return this.transition(
      id,
      dto,
      actor,
      period.status,
      AttendancePeriodStatus.OPEN,
      'REOPEN',
      {
        reopenedByUserId: actor.id,
        reopenedAt: new Date(),
        reopenReason: dto.reopenReason.trim(),
        lockedByUserId: null,
        lockedAt: null,
        payrollPendingByUserId: null,
        payrollPendingAt: null,
        closedByUserId: null,
        closedAt: null,
      },
    );
  }

  private async assertNoLockBlockers(periodId: string) {
    const period = await this.findOne(periodId);

    const openMissing = await this.prisma.attendanceException.count({
      where: {
        branchId: period.branchId,
        businessDate: {
          gte: period.periodStart,
          lte: period.periodEnd,
        },
        status: AttendanceExceptionStatus.OPEN,
        type: {
          in: [
            AttendanceExceptionType.MISSING_CHECK_IN,
            AttendanceExceptionType.MISSING_CHECK_OUT,
          ],
        },
      },
    });

    const submittedRegs = await this.prisma.attendanceRegularization.count({
      where: {
        branchId: period.branchId,
        status: AttendanceRegularizationStatus.SUBMITTED,
        attendance: {
          attendanceDate: {
            gte: period.periodStart,
            lte: period.periodEnd,
          },
        },
      },
    });

    if (openMissing > 0 || submittedRegs > 0) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message:
          'Period cannot be locked while open missing-punch exceptions or submitted regularizations remain',
      });
    }
  }

  private async transition(
    id: string,
    dto: AttendancePeriodTransitionDto,
    actor: AuthenticatedUser,
    fromStatus: AttendancePeriodStatus,
    toStatus: AttendancePeriodStatus,
    auditAction: string,
    extra: Prisma.AttendancePeriodUncheckedUpdateManyInput,
  ) {
    await this.findOne(id);

    const result = await this.prisma.$transaction(async (tx) => {
      const transition = await tx.attendancePeriod.updateMany({
        where: {
          id,
          version: dto.expectedVersion,
          status: fromStatus,
        },
        data: {
          status: toStatus,
          version: { increment: 1 },
          ...extra,
        },
      });

      if (transition.count !== 1) {
        throw new ConflictException({
          code: WorkforceTimeErrorCode.STALE_TRANSITION,
          message: `Attendance period cannot transition from ${fromStatus}`,
        });
      }

      const updated = await tx.attendancePeriod.findUniqueOrThrow({
        where: { id },
      });

      await this.auditService.log(
        'AttendancePeriod',
        id,
        auditAction,
        { status: fromStatus, version: dto.expectedVersion },
        { status: toStatus, version: updated.version, actorUserId: actor.id },
        { tx },
      );

      return updated;
    });

    return result;
  }
}
