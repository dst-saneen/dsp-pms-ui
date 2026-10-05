import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import {
  AttendanceExceptionType,
  AttendancePeriodStatus,
  Prisma,
} from '@prisma/client';

import { WorkforceErrorCode } from '../../common/constants';
import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarConsumerService } from '../business-calendar/business-calendar-consumer.service';
import { OvertimeRequestService } from '../overtime-request/overtime-request.service';
import { AttendancePolicyResolverService } from '../workforce-policy/attendance-policy-resolver.service';

import {
  MAX_OPEN_SHIFT_MS,
  calculateAttendanceMetrics,
  calculateLateMinutes,
  calendarDateToUtcMidnight,
  isValidIanaTimeZone,
  toCalendarDate,
} from './attendance-calendar.util';
import { findApprovedFullDayLeaveCovering } from './attendance-approved-leave.util';
import { AttendanceExceptionService } from './attendance-exception.service';
import {
  RosterScheduleSnapshot,
  calculateRosterAwareMetrics,
  calculateRosterLateMinutes,
  defaultRosterAwarePolicy,
} from './attendance-roster-metrics.util';
import { BranchTimeService } from './branch-time.service';
import {
  AttendanceApprovalStatus,
  AttendanceSource,
  AttendanceStatus,
} from './constants';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly auditService: AuditService,
    private readonly branchTime: BranchTimeService,
    private readonly attendancePolicyResolver: AttendancePolicyResolverService,
    private readonly attendanceExceptionService: AttendanceExceptionService,
    private readonly calendarConsumer: BusinessCalendarConsumerService,
    @Inject(forwardRef(() => OvertimeRequestService))
    private readonly overtimeRequestService: OvertimeRequestService,
  ) {}

  async create(dto: CreateAttendanceDto, actor: AuthenticatedUser) {
    const employee = await this.loadEmployeeContext(dto.employeeId);
    await this.assertPeriodNotLocked(
      employee.branchId,
      employee.companyId,
      dto.attendanceDate,
    );

    const timeZone = this.branchTime.requireTimezone(employee.branch.timezone);
    const attendanceCalendarDate = toCalendarDate(dto.attendanceDate, timeZone);
    const attendanceDate = calendarDateToUtcMidnight(attendanceCalendarDate);

    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId: dto.employeeId,
          attendanceDate,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        code: WorkforceErrorCode.ATTENDANCE_STATE_CHANGED,
        message: 'Attendance already exists for this date',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const created = await tx.attendance.create({
        data: {
          employeeId: dto.employeeId,
          attendanceDate,
          remarks: dto.remarks,
          status: AttendanceStatus.PRESENT,
          source: AttendanceSource.MANUAL,
          approvalStatus: AttendanceApprovalStatus.APPROVED,
        },
      });

      await this.auditService.log(
        'Attendance',
        created.id,
        'CREATE',
        null,
        {
          status: created.status,
          attendanceDate: attendanceCalendarDate,
          actorUserId: actor.id,
        },
        { tx },
      );

      return created;
    });
  }

  async findAll(filters: AttendanceFilterDto) {
    const where: Prisma.AttendanceWhereInput = {
      isActive: true,
      ...this.employeeDomainScope.attendanceWhere(),
    };

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.status) {
      where.status = filters.status.toUpperCase();
    }

    if (filters.companyId || filters.branchId || filters.search?.trim()) {
      where.employee = {
        ...(filters.companyId ? { companyId: filters.companyId } : {}),
        ...(filters.branchId ? { branchId: filters.branchId } : {}),
        ...(filters.search?.trim()
          ? {
              OR: [
                {
                  employeeCode: {
                    contains: filters.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  firstName: {
                    contains: filters.search.trim(),
                    mode: 'insensitive',
                  },
                },
                {
                  lastName: {
                    contains: filters.search.trim(),
                    mode: 'insensitive',
                  },
                },
              ],
            }
          : {}),
      };
    }

    if (filters.fromDate || filters.toDate) {
      where.attendanceDate = {};
      if (filters.fromDate) {
        where.attendanceDate.gte = new Date(
          `${filters.fromDate}T00:00:00.000Z`,
        );
      }
      if (filters.toDate) {
        where.attendanceDate.lte = new Date(`${filters.toDate}T00:00:00.000Z`);
      }
    }

    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.attendance.findMany({
        where,
        include: {
          employee: {
            include: {
              branch: {
                select: { id: true, timezone: true, branchName: true },
              },
            },
          },
          shift: true,
          shiftRosterEntry: true,
        },
        orderBy: {
          attendanceDate: 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.attendance.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: string) {
    const attendance = await this.prisma.attendance.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.attendanceWhere(),
      },
      include: {
        employee: true,
        shift: true,
        shiftRosterEntry: true,
      },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance not found');
    }

    return attendance;
  }

  async checkIn(dto: CheckInDto, actor: AuthenticatedUser) {
    const employeeId = this.resolveEmployeeId(dto.employeeId, actor);
    const employee = await this.loadEmployeeContext(employeeId);

    const timeZone = this.branchTime.requireTimezone(employee.branch.timezone);
    const now = new Date();
    const businessDate = this.branchTime.businessDate(now, timeZone);
    const attendanceDate = calendarDateToUtcMidnight(businessDate);

    await this.assertPeriodNotLocked(
      employee.branchId,
      employee.companyId,
      businessDate,
    );

    const approvedLeave = await findApprovedFullDayLeaveCovering(
      this.prisma,
      employeeId,
      attendanceDate,
    );
    if (approvedLeave) {
      throw new ConflictException({
        code: WorkforceErrorCode.ATTENDANCE_APPROVED_LEAVE_EXISTS,
        message:
          'You are on approved leave today; check-in is not required. Ask HR to correct attendance if this leave should not apply.',
      });
    }

    const policy = await this.attendancePolicyResolver.resolve({
      companyId: employee.companyId,
      branchId: employee.branchId,
      asOfDate: businessDate,
    });
    const maxOpenMs = policy.maxOpenShiftMinutes * 60 * 1000;

    const rosterEntry =
      await this.attendanceExceptionService.findPublishedRosterEntry(
        employeeId,
        employee.branchId,
        businessDate,
      );

    let schedule = this.snapshotFromRoster(rosterEntry, timeZone);
    if (!rosterEntry) {
      schedule = await this.attachRuntimeDayIfActive(
        schedule,
        employee.companyId,
        employee.branchId,
        businessDate,
      );
    }
    const activeShift = rosterEntry
      ? null
      : await this.loadActiveShift(employeeId, now);

    const late = schedule.scheduledStartAt
      ? calculateRosterLateMinutes({
          checkInTime: now,
          scheduledStartAt: schedule.scheduledStartAt,
          lateGraceMinutes: policy.lateGraceMinutes,
        })
      : {
          isLate: false,
          lateMinutes: calculateLateMinutes({
            checkInTime: now,
            attendanceCalendarDate: businessDate,
            timeZone,
            shift: activeShift?.shift ?? null,
          }),
        };

    const existing = await this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },
    });

    if (existing?.checkInTime) {
      throw new ConflictException({
        code: WorkforceErrorCode.ALREADY_CHECKED_IN,
        message: 'Already checked in for this business date',
      });
    }

    if (existing?.finalizedAt) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Finalized attendance cannot be modified',
      });
    }

    const staleOpen = await this.findOpenAttendance(employeeId);
    if (staleOpen && staleOpen.id !== existing?.id) {
      const age = now.getTime() - (staleOpen.checkInTime?.getTime() ?? 0);
      if (age > maxOpenMs) {
        throw new ConflictException({
          code: WorkforceErrorCode.ATTENDANCE_STATE_CHANGED,
          message:
            'An open attendance older than the max open-shift window requires manager correction before a new check-in',
        });
      }
      throw new ConflictException({
        code: WorkforceErrorCode.ALREADY_CHECKED_IN,
        message: 'An open attendance already exists; check out first',
      });
    }

    const scheduleData = {
      shiftId: schedule.shiftId ?? activeShift?.shiftId ?? null,
      shiftRosterEntryId: schedule.shiftRosterEntryId,
      scheduledStartAt: schedule.scheduledStartAt,
      scheduledEndAt: schedule.scheduledEndAt,
      scheduledBreakMinutes: schedule.scheduledBreakMinutes,
      scheduledNetMinutes: schedule.scheduledNetMinutes,
      scheduleTimezone: schedule.scheduleTimezone ?? timeZone,
      scheduleDayType: schedule.scheduleDayType,
      schedulePortion: schedule.schedulePortion,
      businessCalendarRuntimeDayId:
        schedule.businessCalendarRuntimeDayId ?? null,
    };

    const writeCheckIn = async (
      tx: Prisma.TransactionClient,
      attendanceId: string,
      isCreate: boolean,
    ) => {
      if (late.isLate || late.lateMinutes > 0) {
        if (schedule.scheduledStartAt && late.isLate) {
          await this.attendanceExceptionService.upsertOpen(
            {
              companyId: employee.companyId,
              branchId: employee.branchId,
              employeeId,
              businessDate,
              type: AttendanceExceptionType.LATE,
              attendanceId,
              shiftRosterEntryId: schedule.shiftRosterEntryId,
              details: {
                lateMinutes: late.lateMinutes,
                lateGraceMinutes: policy.lateGraceMinutes,
              },
            },
            tx,
          );
        }
      }

      if (!rosterEntry) {
        await this.attendanceExceptionService.upsertOpen(
          {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId,
            businessDate,
            type: AttendanceExceptionType.UNSCHEDULED_WORK,
            attendanceId,
            details: { reason: 'NO_PUBLISHED_ROSTER_ENTRY' },
          },
          tx,
        );
      }

      await this.auditService.log(
        'Attendance',
        attendanceId,
        'CHECK_IN',
        null,
        {
          checkInTime: now.toISOString(),
          lateMinutes: late.lateMinutes,
          attendanceDate: businessDate,
          shiftRosterEntryId: schedule.shiftRosterEntryId,
          created: isCreate,
        },
        { tx },
      );
    };

    if (!existing) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const created = await tx.attendance.create({
            data: {
              employeeId,
              attendanceDate,
              status: AttendanceStatus.PRESENT,
              checkInTime: now,
              lateMinutes: late.lateMinutes,
              source: AttendanceSource.SELF_SERVICE,
              approvalStatus: AttendanceApprovalStatus.APPROVED,
              ...scheduleData,
            },
          });

          await writeCheckIn(tx, created.id, true);
          return created;
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new ConflictException({
            code: WorkforceErrorCode.ALREADY_CHECKED_IN,
            message: 'Already checked in for this business date',
          });
        }
        throw error;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.updateMany({
        where: {
          id: existing.id,
          checkInTime: null,
          finalizedAt: null,
        },
        data: {
          checkInTime: now,
          lateMinutes: late.lateMinutes,
          status: AttendanceStatus.PRESENT,
          source: AttendanceSource.SELF_SERVICE,
          ...scheduleData,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException({
          code: WorkforceErrorCode.ALREADY_CHECKED_IN,
          message: 'Already checked in for this business date',
        });
      }

      const attendance = await tx.attendance.findUniqueOrThrow({
        where: { id: existing.id },
        include: { employee: true, shift: true, shiftRosterEntry: true },
      });
      await writeCheckIn(tx, attendance.id, false);
      return attendance;
    });
  }

  async checkOut(dto: CheckOutDto, actor: AuthenticatedUser) {
    const employeeId = this.resolveEmployeeId(dto.employeeId, actor);
    const employee = await this.loadEmployeeContext(employeeId);

    const timeZone = this.branchTime.requireTimezone(employee.branch.timezone);
    const now = new Date();
    const businessDate = this.branchTime.businessDate(now, timeZone);

    const openAttendance = await this.findOpenAttendance(employeeId);
    if (!openAttendance?.checkInTime) {
      throw new ConflictException({
        code: WorkforceErrorCode.NOT_CHECKED_IN,
        message: 'No open check-in found for checkout',
      });
    }

    if (openAttendance.checkOutTime) {
      throw new ConflictException({
        code: WorkforceErrorCode.ALREADY_CHECKED_OUT,
        message: 'Already checked out',
      });
    }

    if (openAttendance.finalizedAt) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Finalized attendance cannot be modified',
      });
    }

    await this.assertPeriodNotLocked(
      employee.branchId,
      employee.companyId,
      openAttendance.attendanceDate,
    );

    const policyResolved = await this.attendancePolicyResolver.resolve({
      companyId: employee.companyId,
      branchId: employee.branchId,
      asOfDate: openAttendance.attendanceDate,
    });
    const maxOpenMs = policyResolved.maxOpenShiftMinutes * 60 * 1000;

    const openAge = now.getTime() - openAttendance.checkInTime.getTime();
    if (openAge > maxOpenMs) {
      throw new ConflictException({
        code: WorkforceErrorCode.ATTENDANCE_STATE_CHANGED,
        message:
          'Open attendance exceeds max open-shift window and requires manager correction',
      });
    }

    const attendanceCalendarDate = toCalendarDate(
      openAttendance.attendanceDate,
      'UTC',
    );

    const schedule: RosterScheduleSnapshot = {
      shiftRosterEntryId: openAttendance.shiftRosterEntryId,
      shiftId: openAttendance.shiftId,
      scheduledStartAt: openAttendance.scheduledStartAt,
      scheduledEndAt: openAttendance.scheduledEndAt,
      scheduledBreakMinutes: openAttendance.scheduledBreakMinutes,
      scheduledNetMinutes: openAttendance.scheduledNetMinutes,
      scheduleTimezone: openAttendance.scheduleTimezone,
      scheduleDayType: openAttendance.scheduleDayType,
      schedulePortion: openAttendance.schedulePortion,
    };

    const hasRosterSchedule = Boolean(schedule.scheduledStartAt);

    let metrics: {
      workedHours: number;
      lateMinutes: number;
      earlyDepartureMinutes: number;
      overtimeMinutes: number;
      status: string;
      classificationReason?: string;
      isLate?: boolean;
      isEarlyDeparture?: boolean;
      isInsufficientHours?: boolean;
    };

    if (hasRosterSchedule) {
      metrics = calculateRosterAwareMetrics({
        checkInTime: openAttendance.checkInTime,
        checkOutTime: now,
        schedule,
        policy: {
          lateGraceMinutes: policyResolved.lateGraceMinutes,
          earlyDepartureGraceMinutes: policyResolved.earlyDepartureGraceMinutes,
          fullDayThresholdPercent: policyResolved.fullDayThresholdPercent,
          halfDayThresholdPercent: policyResolved.halfDayThresholdPercent,
          maxOpenShiftMinutes: policyResolved.maxOpenShiftMinutes,
        },
      });
    } else {
      const shift =
        openAttendance.shift ??
        (await this.loadActiveShift(employeeId, openAttendance.checkInTime))
          ?.shift ??
        null;
      const legacy = calculateAttendanceMetrics({
        checkInTime: openAttendance.checkInTime,
        checkOutTime: now,
        attendanceCalendarDate,
        timeZone,
        shift,
      });
      metrics = { ...legacy, classificationReason: 'LEGACY_SHIFT' };
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.updateMany({
        where: {
          id: openAttendance.id,
          checkOutTime: null,
          checkInTime: { not: null },
          finalizedAt: null,
        },
        data: {
          checkOutTime: now,
          workedHours: metrics.workedHours,
          earlyDepartureMinutes: metrics.earlyDepartureMinutes,
          overtimeMinutes: metrics.overtimeMinutes,
          lateMinutes: openAttendance.lateMinutes || metrics.lateMinutes,
          status: metrics.status,
          classificationReason: metrics.classificationReason ?? null,
        },
      });

      if (updated.count !== 1) {
        throw new ConflictException({
          code: WorkforceErrorCode.ALREADY_CHECKED_OUT,
          message: 'Attendance state changed during checkout',
        });
      }

      if (metrics.isEarlyDeparture) {
        await this.attendanceExceptionService.upsertOpen(
          {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId,
            businessDate: attendanceCalendarDate,
            type: AttendanceExceptionType.EARLY_DEPARTURE,
            attendanceId: openAttendance.id,
            shiftRosterEntryId: schedule.shiftRosterEntryId,
            details: {
              earlyDepartureMinutes: metrics.earlyDepartureMinutes,
            },
          },
          tx,
        );
      }

      if (metrics.isInsufficientHours) {
        await this.attendanceExceptionService.upsertOpen(
          {
            companyId: employee.companyId,
            branchId: employee.branchId,
            employeeId,
            businessDate: attendanceCalendarDate,
            type: AttendanceExceptionType.INSUFFICIENT_HOURS,
            attendanceId: openAttendance.id,
            shiftRosterEntryId: schedule.shiftRosterEntryId,
            details: {
              status: metrics.status,
              classificationReason: metrics.classificationReason,
            },
          },
          tx,
        );
      }

      const attendance = await tx.attendance.findUniqueOrThrow({
        where: { id: openAttendance.id },
        include: { employee: true, shift: true, shiftRosterEntry: true },
      });

      await this.auditService.log(
        'Attendance',
        attendance.id,
        'CHECK_OUT',
        null,
        {
          status: attendance.status,
          checkOutTime: attendance.checkOutTime?.toISOString(),
          workedHours: Number(attendance.workedHours),
          classificationReason: attendance.classificationReason,
          businessDate,
        },
        { tx },
      );

      await this.overtimeRequestService.syncCalculatedFromAttendance(
        attendance.id,
        tx,
      );

      return attendance;
    });
  }

  async correct(
    id: string,
    dto: CorrectAttendanceDto,
    actor: AuthenticatedUser,
  ) {
    const attendance = await this.findOne(id);
    const employee = await this.loadEmployeeContext(attendance.employeeId);
    await this.assertPeriodNotLocked(
      employee.branchId,
      employee.companyId,
      attendance.attendanceDate,
    );

    if (attendance.finalizedAt) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.STALE_TRANSITION,
        message: 'Finalized attendance cannot be modified',
      });
    }

    const timeZone = this.branchTime.requireTimezone(employee.branch.timezone);
    const attendanceCalendarDate = toCalendarDate(
      attendance.attendanceDate,
      'UTC',
    );

    const checkInTime = dto.checkInTime
      ? new Date(dto.checkInTime)
      : attendance.checkInTime;
    const checkOutTime = dto.checkOutTime
      ? new Date(dto.checkOutTime)
      : attendance.checkOutTime;

    if (checkInTime && checkOutTime && checkOutTime < checkInTime) {
      throw new BadRequestException('Check-out cannot precede check-in');
    }

    let metrics = {
      workedHours: Number(attendance.workedHours),
      lateMinutes: attendance.lateMinutes,
      earlyDepartureMinutes: attendance.earlyDepartureMinutes,
      overtimeMinutes: attendance.overtimeMinutes,
      status: attendance.status,
      classificationReason: attendance.classificationReason,
    };

    const schedule: RosterScheduleSnapshot = {
      shiftRosterEntryId: attendance.shiftRosterEntryId,
      shiftId: attendance.shiftId,
      scheduledStartAt: attendance.scheduledStartAt,
      scheduledEndAt: attendance.scheduledEndAt,
      scheduledBreakMinutes: attendance.scheduledBreakMinutes,
      scheduledNetMinutes: attendance.scheduledNetMinutes,
      scheduleTimezone: attendance.scheduleTimezone,
      scheduleDayType: attendance.scheduleDayType,
      schedulePortion: attendance.schedulePortion,
    };

    if (checkInTime && checkOutTime && schedule.scheduledStartAt) {
      const policy = await this.attendancePolicyResolver.resolve({
        companyId: employee.companyId,
        branchId: employee.branchId,
        asOfDate: attendance.attendanceDate,
      });
      metrics = calculateRosterAwareMetrics({
        checkInTime,
        checkOutTime,
        schedule,
        policy: {
          lateGraceMinutes: policy.lateGraceMinutes,
          earlyDepartureGraceMinutes: policy.earlyDepartureGraceMinutes,
          fullDayThresholdPercent: policy.fullDayThresholdPercent,
          halfDayThresholdPercent: policy.halfDayThresholdPercent,
          maxOpenShiftMinutes: policy.maxOpenShiftMinutes,
        },
      });
    } else if (checkInTime && checkOutTime) {
      metrics = {
        ...calculateAttendanceMetrics({
          checkInTime,
          checkOutTime,
          attendanceCalendarDate,
          timeZone,
          shift: attendance.shift,
        }),
        classificationReason: 'LEGACY_CORRECTION',
      };
    } else if (checkInTime && !checkOutTime) {
      if (schedule.scheduledStartAt) {
        const policy = await this.attendancePolicyResolver.resolve({
          companyId: employee.companyId,
          branchId: employee.branchId,
          asOfDate: attendance.attendanceDate,
        });
        const late = calculateRosterLateMinutes({
          checkInTime,
          scheduledStartAt: schedule.scheduledStartAt,
          lateGraceMinutes: policy.lateGraceMinutes,
        });
        metrics.lateMinutes = late.lateMinutes;
      } else {
        metrics.lateMinutes = calculateLateMinutes({
          checkInTime,
          attendanceCalendarDate,
          timeZone,
          shift: attendance.shift,
        });
      }
    }

    const remarks = [
      dto.remarks?.trim() || attendance.remarks,
      `[CORRECTION by ${actor.id}] ${dto.correctionReason.trim()}`,
    ]
      .filter(Boolean)
      .join(' | ');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.attendance.update({
        where: { id },
        data: {
          checkInTime: checkInTime ?? null,
          checkOutTime: checkOutTime ?? null,
          status: dto.status ?? metrics.status,
          workedHours: metrics.workedHours,
          lateMinutes: metrics.lateMinutes,
          earlyDepartureMinutes: metrics.earlyDepartureMinutes,
          overtimeMinutes: metrics.overtimeMinutes,
          classificationReason: metrics.classificationReason ?? null,
          remarks,
          source: attendance.source ?? AttendanceSource.MANUAL,
          approvalStatus: AttendanceApprovalStatus.APPROVED,
          lastModifiedByUserId: actor.id,
          lastModifiedAt: new Date(),
        },
      });

      await this.attendanceExceptionService.resolveForAttendance(
        id,
        'MANAGER_CORRECTION',
        actor.id,
        tx,
      );

      // HR Correct is the one-step fix: drop pending propose-fix requests so
      // Approve-by-manager is not still required, and period lock is not blocked.
      const pendingRegs = await tx.attendanceRegularization.findMany({
        where: {
          attendanceId: id,
          status: 'SUBMITTED',
        },
        select: { id: true, approvalTransactionId: true },
      });
      for (const reg of pendingRegs) {
        await tx.attendanceRegularization.update({
          where: { id: reg.id },
          data: { status: 'CANCELLED' },
        });
        if (reg.approvalTransactionId) {
          await tx.approvalTransaction.update({
            where: { id: reg.approvalTransactionId },
            data: { status: 'CANCELLED' },
          });
        }
        await this.auditService.log(
          'AttendanceRegularization',
          reg.id,
          'CANCEL',
          { status: 'SUBMITTED' },
          {
            status: 'CANCELLED',
            reason: 'Superseded by attendance correction',
            actorUserId: actor.id,
          },
          { tx },
        );
      }

      await this.auditService.log(
        'Attendance',
        updated.id,
        'CORRECT',
        {
          checkInTime: attendance.checkInTime?.toISOString() ?? null,
          checkOutTime: attendance.checkOutTime?.toISOString() ?? null,
          status: attendance.status,
        },
        {
          checkInTime: updated.checkInTime?.toISOString() ?? null,
          checkOutTime: updated.checkOutTime?.toISOString() ?? null,
          status: updated.status,
          workedHours: Number(updated.workedHours),
          correctionReason: dto.correctionReason,
          actorUserId: actor.id,
        },
        { tx },
      );

      if (updated.checkInTime && updated.checkOutTime) {
        await this.overtimeRequestService.syncCalculatedFromAttendance(
          updated.id,
          tx,
        );
      }

      return updated;
    });
  }

  async getTodayAttendance(employeeId: string) {
    const employee = await this.loadEmployeeContext(employeeId);
    const timeZone = this.branchTime.requireTimezone(employee.branch.timezone);
    const businessDate = toCalendarDate(new Date(), timeZone);
    const attendanceDate = calendarDateToUtcMidnight(businessDate);

    return this.prisma.attendance.findUnique({
      where: {
        employeeId_attendanceDate: {
          employeeId,
          attendanceDate,
        },
      },
      include: {
        shift: true,
        shiftRosterEntry: true,
      },
    });
  }

  async assertPeriodNotLocked(
    branchId: string,
    companyId: string,
    dateValue: Date | string,
  ): Promise<void> {
    const calendarDate =
      typeof dateValue === 'string'
        ? dateValue.slice(0, 10)
        : dateValue.toISOString().slice(0, 10);
    const year = Number(calendarDate.slice(0, 4));
    const month = Number(calendarDate.slice(5, 7));

    const period = await this.prisma.attendancePeriod.findUnique({
      where: {
        branchId_periodYear_periodMonth: {
          branchId,
          periodYear: year,
          periodMonth: month,
        },
      },
      select: { status: true },
    });

    if (
      period &&
      (period.status === AttendancePeriodStatus.LOCKED ||
        period.status === AttendancePeriodStatus.PAYROLL_PENDING ||
        period.status === AttendancePeriodStatus.CLOSED)
    ) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.ATTENDANCE_PERIOD_LOCKED,
        message: 'Attendance period is locked for this month',
      });
    }

    void companyId;
  }

  private async attachRuntimeDayIfActive(
    schedule: RosterScheduleSnapshot,
    companyId: string,
    branchId: string,
    businessDate: string,
  ): Promise<RosterScheduleSnapshot> {
    const active = await this.calendarConsumer.isActiveOffice(
      companyId,
      branchId,
    );
    if (!active) {
      return schedule;
    }

    const days = await this.calendarConsumer.resolveConsumerDays({
      companyId,
      branchId,
      from: businessDate,
      to: businessDate,
    });
    const day = days.get(businessDate);
    return {
      ...schedule,
      businessCalendarRuntimeDayId: day?.runtimeDayId ?? null,
    };
  }

  private snapshotFromRoster(
    rosterEntry: {
      id: string;
      shiftId: string | null;
      scheduledStartAt: Date | null;
      scheduledEndAt: Date | null;
      breakMinutes: number;
      scheduledNetMinutes: number;
      timezone: string;
      dayType: RosterScheduleSnapshot['scheduleDayType'];
      dayPortion: RosterScheduleSnapshot['schedulePortion'];
      businessCalendarRuntimeDayId?: string | null;
    } | null,
    fallbackTimezone: string,
  ): RosterScheduleSnapshot {
    if (!rosterEntry) {
      return {
        shiftRosterEntryId: null,
        shiftId: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        scheduledBreakMinutes: null,
        scheduledNetMinutes: null,
        scheduleTimezone: fallbackTimezone,
        scheduleDayType: null,
        schedulePortion: null,
        businessCalendarRuntimeDayId: null,
      };
    }

    return {
      shiftRosterEntryId: rosterEntry.id,
      shiftId: rosterEntry.shiftId,
      scheduledStartAt: rosterEntry.scheduledStartAt,
      scheduledEndAt: rosterEntry.scheduledEndAt,
      scheduledBreakMinutes: rosterEntry.breakMinutes,
      scheduledNetMinutes: rosterEntry.scheduledNetMinutes,
      scheduleTimezone: rosterEntry.timezone || fallbackTimezone,
      scheduleDayType: rosterEntry.dayType,
      schedulePortion: rosterEntry.dayPortion,
      businessCalendarRuntimeDayId:
        rosterEntry.businessCalendarRuntimeDayId ?? null,
    };
  }

  private resolveEmployeeId(
    requestedEmployeeId: string | undefined,
    actor: AuthenticatedUser,
  ): string {
    if (!requestedEmployeeId) {
      if (!actor.employeeId) {
        throw new BadRequestException({
          code: WorkforceErrorCode.EMPLOYEE_LINK_REQUIRED,
          message: 'Authenticated user is not linked to an employee',
        });
      }
      return actor.employeeId;
    }

    return requestedEmployeeId;
  }

  private async loadEmployeeContext(employeeId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        isActive: true,
        ...this.employeeDomainScope.employeeWhere(),
      },
      include: {
        branch: true,
      },
    });

    if (!employee) {
      this.employeeDomainScope.notFound('Employee');
    }

    return employee;
  }

  private async loadActiveShift(employeeId: string, at: Date) {
    return this.prisma.employeeShift.findFirst({
      where: {
        employeeId,
        isActive: true,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: at } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  private async findOpenAttendance(employeeId: string) {
    return this.prisma.attendance.findFirst({
      where: {
        employeeId,
        isActive: true,
        checkInTime: { not: null },
        checkOutTime: null,
      },
      include: {
        shift: true,
        shiftRosterEntry: true,
      },
      orderBy: {
        checkInTime: 'desc',
      },
    });
  }
}

/** Re-export for tests that still import MAX_OPEN_SHIFT_MS via service module. */
export { MAX_OPEN_SHIFT_MS, isValidIanaTimeZone, defaultRosterAwarePolicy };
