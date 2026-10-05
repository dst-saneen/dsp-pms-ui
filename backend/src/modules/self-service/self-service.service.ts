import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth';
import { AttendanceService } from '../attendance/attendance.service';
import { AttendanceRegularizationService } from '../attendance/attendance-regularization.service';
import { BranchTimeService } from '../attendance/branch-time.service';
import { CreateAttendanceRegularizationDto } from '../attendance/dto/attendance-workforce.dto';
import { CompOffCreditService } from '../comp-off/comp-off-credit.service';
import { EmployeeAssetService } from '../employee-asset/employee-asset.service';
import { AssetDepartmentGrantQueryService } from '../asset-domain/asset-department-grant-query.service';
import { AssetSelfServiceQueryService } from '../asset-domain/asset-self-service-query.service';
import { createAssetAccessContext } from '../asset-domain/asset-access.types';
import { EmployeeDocumentService } from '../employee-document/employee-document.service';
import { EmployeeLeaveService } from '../employee-leave/employee-leave.service';
import { EmployeeOnboardingRepository } from '../employee-onboarding/repositories/employee-onboarding.repository';
import { LeaveRequestService } from '../leave-request/leave-request.service';
import { CancelLeaveRequestDto } from '../leave-request/dto/cancel-leave-request.dto';
import { LeavePolicyResolverService } from '../leave-policy/leave-policy-resolver.service';
import {
  CancelOvertimeRequestDto,
  SubmitOvertimeRequestDto,
} from '../overtime-request/dto';
import { OvertimeRequestService } from '../overtime-request/overtime-request.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ShiftRosterStatus, LeaveTypeCategory } from '@prisma/client';
import { toCalendarDate } from '../attendance/attendance-calendar.util';
import { LeaveRequestStatus } from '../employee-leave/constants';
import { WorkforceCalendarService } from '../workforce-calendar/workforce-calendar.service';
import { WorkScheduleItemService } from '../work-schedule-item/work-schedule-item.service';

import {
  CreateMyLeaveRequestDto,
  UpdateMyLeaveRequestDto,
} from './dto/my-leave-request.dto';
import {
  SelfServiceContext,
  SelfServiceContextService,
} from './self-service-context.service';

@Injectable()
export class SelfServiceService {
  constructor(
    private readonly contextService: SelfServiceContextService,
    private readonly employeeLeaveService: EmployeeLeaveService,
    private readonly leaveRequestService: LeaveRequestService,
    private readonly leavePolicyResolver: LeavePolicyResolverService,
    private readonly attendanceService: AttendanceService,
    private readonly attendanceRegularizationService: AttendanceRegularizationService,
    private readonly branchTime: BranchTimeService,
    private readonly employeeDocumentService: EmployeeDocumentService,
    private readonly employeeAssetService: EmployeeAssetService,
    private readonly assetSelfServiceQuery: AssetSelfServiceQueryService,
    private readonly assetGrantQuery: AssetDepartmentGrantQueryService,
    private readonly employeeOnboardingRepository: EmployeeOnboardingRepository,
    private readonly overtimeRequestService: OvertimeRequestService,
    private readonly compOffCreditService: CompOffCreditService,
    private readonly workforceCalendarService: WorkforceCalendarService,
    private readonly workScheduleItemService: WorkScheduleItemService,
    private readonly prisma: PrismaService,
  ) {}

  async getWorkspace(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    const year = new Date().getFullYear();
    const timezone = this.branchTime.requireTimezone(context.branch.timezone);
    const today = toCalendarDate(new Date(), timezone);

    const [
      attendance,
      leave,
      onboarding,
      documents,
      documentSummary,
      assets,
      shiftRosterToday,
      todayWorkItems,
      approvedFullDayLeave,
    ] = await Promise.all([
      this.attendanceService.getTodayAttendance(context.employeeId),
      this.employeeLeaveService.getProfile(context.employeeId, year),
      this.getOnboarding(context.employeeId),
      this.employeeDocumentService.findByEmployee(context.employeeId),
      this.employeeDocumentService.employeeSummary(context.employeeId),
      this.assetSelfServiceQuery.findCurrentByEmployee(context.employeeId),
      this.getShiftRoster(actor, {
        fromDate: today,
        toDate: today,
      }),
      this.workScheduleItemService.getEmployeeTodayItems(context.employeeId),
      this.prisma.leaveRequest.findFirst({
        where: {
          employeeId: context.employeeId,
          isActive: true,
          status: LeaveRequestStatus.APPROVED,
          isHalfDay: false,
          fromDate: { lte: new Date(`${today}T00:00:00.000Z`) },
          toDate: { gte: new Date(`${today}T00:00:00.000Z`) },
        },
        select: { id: true },
      }),
    ]);

    return {
      identity: this.toIdentity(context),
      businessDate: today,
      timezone,
      todayAttendance: attendance,
      todayShift: shiftRosterToday[0]
        ? {
            workDate: shiftRosterToday[0].workDate,
            dayType: shiftRosterToday[0].dayType,
            shiftName: shiftRosterToday[0].shift?.shiftName ?? null,
            scheduledStartAt: shiftRosterToday[0].scheduledStartAt,
            scheduledEndAt: shiftRosterToday[0].scheduledEndAt,
          }
        : null,
      punchReadiness: this.buildPunchReadiness({
        businessDate: today,
        todayShift: shiftRosterToday[0]
          ? { dayType: shiftRosterToday[0].dayType }
          : null,
        todayAttendance: attendance
          ? {
              checkInTime: attendance.checkInTime,
              checkOutTime: attendance.checkOutTime,
            }
          : null,
        hasApprovedFullDayLeave: Boolean(approvedFullDayLeave),
      }),
      todayWorkPlan: {
        itemCount: todayWorkItems.length,
        items: todayWorkItems.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          plannedStartTime: item.plannedStartTime,
          plannedEndTime: item.plannedEndTime,
        })),
      },
      leave: {
        summary: leave.summary,
        balances: leave.balances,
        upcoming: leave.upcoming,
      },
      onboarding,
      documents: {
        summary: documentSummary,
        expiringSoon: documents.filter((doc) => {
          if (!doc.expiryDate) {
            return false;
          }
          const inThirtyDays = Date.now() + 30 * 24 * 60 * 60 * 1000;
          return (
            doc.expiryDate.getTime() <= inThirtyDays &&
            doc.expiryDate.getTime() >= Date.now()
          );
        }).length,
        expired: documentSummary.expired,
      },
      assets: {
        assignedCount: assets.length,
        items: assets,
      },
    };
  }

  private buildPunchReadiness(input: {
    businessDate: string;
    todayShift: { dayType: string } | null;
    todayAttendance: {
      checkInTime: Date | string | null;
      checkOutTime: Date | string | null;
    } | null;
    hasApprovedFullDayLeave?: boolean;
  }) {
    const checkedIn = Boolean(input.todayAttendance?.checkInTime);
    const checkedOut = Boolean(input.todayAttendance?.checkOutTime);
    const dayType = input.todayShift?.dayType ?? null;

    let canCheckIn = true;
    let checkInBlockedReason: string | null = null;
    let setupHref: string | null = null;

    if (input.hasApprovedFullDayLeave) {
      canCheckIn = false;
      checkInBlockedReason =
        'You are on approved leave today; check-in is not required.';
    } else if (checkedIn && checkedOut) {
      canCheckIn = false;
      checkInBlockedReason =
        'Already finished for today (checked in and out). One pair of punches is enough.';
    } else if (checkedIn) {
      canCheckIn = false;
      checkInBlockedReason = 'Already checked in for this business day.';
    } else if (!input.todayShift) {
      canCheckIn = false;
      checkInBlockedReason =
        'No published work schedule for today. Ask HR to publish a Work Schedule covering this date, then open My calendar to confirm.';
      setupHref = '/my-workspace/calendar';
    } else if (dayType === 'HOLIDAY') {
      canCheckIn = false;
      checkInBlockedReason =
        'Today is a full-day holiday on your published schedule. Check My calendar if this looks wrong.';
      setupHref = '/my-workspace/calendar';
    } else if (dayType === 'WEEK_OFF') {
      canCheckIn = false;
      checkInBlockedReason =
        'Today is a week off on your published schedule. Check My calendar if this looks wrong.';
      setupHref = '/my-workspace/calendar';
    }

    let canCheckOut = true;
    let checkOutBlockedReason: string | null = null;
    if (!checkedIn) {
      canCheckOut = false;
      checkOutBlockedReason = 'Check in first.';
    } else if (checkedOut) {
      canCheckOut = false;
      checkOutBlockedReason = 'Already checked out for this business day.';
    }

    return {
      businessDate: input.businessDate,
      canCheckIn,
      canCheckOut,
      checkInBlockedReason,
      checkOutBlockedReason,
      setupHref,
    };
  }

  async getOnboarding(actorOrEmployeeId: AuthenticatedUser | string) {
    const employeeId =
      typeof actorOrEmployeeId === 'string'
        ? actorOrEmployeeId
        : (await this.contextService.resolve(actorOrEmployeeId)).employeeId;

    const active =
      await this.employeeOnboardingRepository.findActiveByEmployee(employeeId);
    const onboarding =
      active ??
      (await this.employeeOnboardingRepository.findByEmployee(employeeId));

    if (!onboarding) {
      return {
        status: 'NOT_STARTED',
        progressPercent: 0,
        tasks: [],
      };
    }

    const withTasks = onboarding as typeof onboarding & {
      tasks?: Array<{
        id: string;
        taskName: string;
        status: string;
        dueDate: Date | null;
        completedDate: Date | null;
      }>;
    };
    const tasks = withTasks.tasks ?? [];
    const completed = tasks.filter(
      (task) => task.status === 'COMPLETED' || task.status === 'SKIPPED',
    ).length;
    const progressPercent =
      tasks.length === 0 ? 0 : Math.round((completed / tasks.length) * 100);

    return {
      id: onboarding.id,
      status: onboarding.status,
      progressPercent: onboarding.progress ?? progressPercent,
      startedAt: onboarding.startDate,
      completedAt: onboarding.completedDate,
      tasks: tasks.map((task) => ({
        id: task.id,
        taskName: task.taskName,
        status: task.status,
        dueDate: task.dueDate,
        completedAt: task.completedDate,
      })),
    };
  }

  async getDocuments(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    const [items, summary] = await Promise.all([
      this.employeeDocumentService.findByEmployee(context.employeeId),
      this.employeeDocumentService.employeeSummary(context.employeeId),
    ]);
    return { summary, items };
  }

  async getAssets(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.assetSelfServiceQuery.findMyAssets(context.employeeId);
  }

  async getAssetDepartments(actor: AuthenticatedUser) {
    return this.assetGrantQuery.findMyGrantedDepartments(
      createAssetAccessContext(actor),
    );
  }

  async getLeave(actor: AuthenticatedUser, year?: number) {
    const context = await this.contextService.resolve(actor);
    return this.employeeLeaveService.getProfile(
      context.employeeId,
      year ?? new Date().getFullYear(),
    );
  }

  async getLeaveTypes(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.prisma.leaveType.findMany({
      where: {
        companyId: context.company.id,
        isActive: true,
        category: { not: LeaveTypeCategory.OPTIONAL_HOLIDAY },
      },
      select: {
        id: true,
        leaveCode: true,
        leaveName: true,
        category: true,
        allowHalfDay: true,
        isActive: true,
      },
      orderBy: { leaveName: 'asc' },
    });
  }

  /**
   * Same day-count path as create/submit — used so Apply Leave preview matches the server.
   */
  async previewLeaveRequest(
    actor: AuthenticatedUser,
    dto: CreateMyLeaveRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    const year = new Date(dto.fromDate).getUTCFullYear();
    const calculation = await this.leavePolicyResolver.resolveCalculation({
      employeeId: context.employeeId,
      leaveTypeId: dto.leaveTypeId,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      isHalfDay: dto.isHalfDay,
    });

    const profile = await this.employeeLeaveService.getProfile(
      context.employeeId,
      year,
    );
    const balance =
      profile.balances.find((row) => row.leaveTypeId === dto.leaveTypeId) ??
      null;

    const available = balance ? Number(balance.balance ?? 0) : 0;
    const pending = balance ? Number(balance.pending ?? 0) : 0;
    const used = balance ? Number(balance.used ?? 0) : 0;
    const entitlement = balance ? Number(balance.entitlement ?? 0) : 0;
    const requested = calculation.requestedWorkingDays;
    const afterSubmitAvailable = available - requested;
    const insufficient =
      !calculation.allowNegativeBalance && afterSubmitAvailable < 0;

    return {
      requestedWorkingDays: requested,
      fromCalendarDate: calculation.fromCalendarDate,
      toCalendarDate: calculation.toCalendarDate,
      timezone: calculation.timezone,
      excludedHolidays: calculation.excludedHolidays,
      excludedNonWorkingDays: calculation.excludedNonWorkingDays,
      isHalfDay: Boolean(dto.isHalfDay),
      balance: balance
        ? {
            year,
            leaveTypeId: dto.leaveTypeId,
            leaveName: balance.leaveName ?? null,
            entitlement,
            used,
            pending,
            available,
            afterSubmit: {
              available: afterSubmitAvailable,
              pending: pending + requested,
              used,
            },
          }
        : null,
      canSubmit: !insufficient && requested > 0,
      blockReason: insufficient
        ? `Not enough balance (${available} available, need ${requested}). Ask HR to generate balances or choose fewer days.`
        : requested <= 0
          ? 'No working days in this range (weekend/holiday only). Pick other dates.'
          : null,
      setupLinks: {
        myCalendar: '/my-workspace/calendar',
        leaveBalancesTab: '/my-workspace/calendar',
      },
    };
  }

  async createLeaveRequest(
    actor: AuthenticatedUser,
    dto: CreateMyLeaveRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    return this.leaveRequestService.create({
      employeeId: context.employeeId,
      leaveTypeId: dto.leaveTypeId,
      fromDate: dto.fromDate,
      toDate: dto.toDate,
      isHalfDay: dto.isHalfDay,
      reason: dto.reason,
      attachmentUrl: dto.attachmentUrl,
    });
  }

  async updateLeaveRequest(
    actor: AuthenticatedUser,
    id: string,
    dto: UpdateMyLeaveRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    await this.assertOwnLeaveRequest(id, context.employeeId);
    return this.leaveRequestService.update(id, dto);
  }

  async submitLeaveRequest(actor: AuthenticatedUser, id: string) {
    const context = await this.contextService.resolve(actor);
    await this.assertOwnLeaveRequest(id, context.employeeId);
    return this.leaveRequestService.submit(id, actor);
  }

  async cancelLeaveRequest(
    actor: AuthenticatedUser,
    id: string,
    dto: CancelLeaveRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    await this.assertOwnLeaveRequest(id, context.employeeId);
    return this.leaveRequestService.cancel(id, dto, actor);
  }

  async getAttendance(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    const today = await this.attendanceService.getTodayAttendance(
      context.employeeId,
    );
    return {
      today,
      timezone: context.timezone,
      branchId: context.branch.id,
    };
  }

  async checkIn(actor: AuthenticatedUser) {
    await this.contextService.resolve(actor);
    return this.attendanceService.checkIn({}, actor);
  }

  async checkOut(actor: AuthenticatedUser) {
    await this.contextService.resolve(actor);
    return this.attendanceService.checkOut({}, actor);
  }

  async getOvertime(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.overtimeRequestService.findMine(context.employeeId);
  }

  async submitOvertime(
    actor: AuthenticatedUser,
    id: string,
    dto: SubmitOvertimeRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    const request = await this.overtimeRequestService.findOne(id);
    if (request.employeeId !== context.employeeId) {
      throw new ForbiddenException('Overtime request does not belong to you');
    }
    return this.overtimeRequestService.submit(id, dto, actor);
  }

  async cancelOvertime(
    actor: AuthenticatedUser,
    id: string,
    dto: CancelOvertimeRequestDto,
  ) {
    const context = await this.contextService.resolve(actor);
    const request = await this.overtimeRequestService.findOne(id);
    if (request.employeeId !== context.employeeId) {
      throw new ForbiddenException('Overtime request does not belong to you');
    }
    return this.overtimeRequestService.cancel(id, dto, actor);
  }

  async getCompOff(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.compOffCreditService.findMine(context.employeeId);
  }

  async getShiftRoster(
    actor: AuthenticatedUser,
    filters: { fromDate?: string; toDate?: string },
  ) {
    const context = await this.contextService.resolve(actor);
    const where: {
      employeeId: string;
      workDate?: { gte?: Date; lte?: Date };
      shiftRoster: { status: { in: ShiftRosterStatus[] } };
    } = {
      employeeId: context.employeeId,
      shiftRoster: {
        status: { in: [ShiftRosterStatus.PUBLISHED, ShiftRosterStatus.LOCKED] },
      },
    };
    if (filters.fromDate || filters.toDate) {
      where.workDate = {};
      if (filters.fromDate) {
        where.workDate.gte = new Date(filters.fromDate);
      }
      if (filters.toDate) {
        where.workDate.lte = new Date(filters.toDate);
      }
    }

    return this.prisma.shiftRosterEntry.findMany({
      where,
      include: {
        shift: {
          select: { id: true, shiftName: true, startTime: true, endTime: true },
        },
        shiftRoster: {
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            version: true,
          },
        },
      },
      orderBy: { workDate: 'asc' },
      take: 100,
    });
  }

  async getWorkforceCalendar(
    actor: AuthenticatedUser,
    filters: { fromDate: string; toDate: string; state?: string },
  ) {
    await this.contextService.resolve(actor);
    return this.workforceCalendarService.getSelfCalendar(actor, filters);
  }

  async getAttendanceExceptions(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.prisma.attendanceException.findMany({
      where: { employeeId: context.employeeId },
      include: { attendance: true },
      orderBy: [{ businessDate: 'desc' }, { detectedAt: 'desc' }],
      take: 100,
    });
  }

  async getAttendanceRegularizations(actor: AuthenticatedUser) {
    const context = await this.contextService.resolve(actor);
    return this.attendanceRegularizationService.findAll({
      employeeId: context.employeeId,
    });
  }

  async submitAttendanceRegularization(
    actor: AuthenticatedUser,
    dto: CreateAttendanceRegularizationDto,
  ) {
    const context = await this.contextService.resolve(actor);
    const attendance = await this.attendanceService.findOne(dto.attendanceId);
    if (attendance.employeeId !== context.employeeId) {
      throw new ForbiddenException('Attendance does not belong to you');
    }
    return this.attendanceRegularizationService.submit(dto, actor);
  }

  private toIdentity(context: SelfServiceContext) {
    return {
      userId: context.userId,
      employeeId: context.employeeId,
      employeeCode: context.employee.employeeCode,
      fullName: [context.employee.firstName, context.employee.lastName]
        .filter(Boolean)
        .join(' '),
      email: context.employee.email,
      employmentStatus: context.employee.employmentStatus,
      company: context.company,
      branch: context.branch,
      department: context.department,
      designation: context.designation,
      timezone: context.timezone,
    };
  }

  private async assertOwnLeaveRequest(id: string, employeeId: string) {
    const request = await this.leaveRequestService.findOne(id);
    if (!request) {
      throw new NotFoundException('Leave request not found');
    }
    if (request.employeeId !== employeeId) {
      throw new ForbiddenException('Leave request does not belong to you');
    }
    return request;
  }
}
