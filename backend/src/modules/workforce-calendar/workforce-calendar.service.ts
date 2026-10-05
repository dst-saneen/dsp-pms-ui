import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  BusinessCalendarScope,
  DayPortion,
  Prisma,
  ShiftRosterDayType,
  ShiftRosterStatus,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarConsumerService } from '../business-calendar/business-calendar-consumer.service';
import {
  eachDateInclusive,
  isHolidayRuntimeDay,
} from '../business-calendar/business-calendar-runtime.util';
import {
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
  LeaveRequestStatus,
} from '../employee-leave/constants';

import { leaveCalendarApprovalStage } from '../leave-request/leave-request-progress';
import {
  WorkforceCalendarDay,
  WorkforceCalendarEmployeeDay,
  WorkforceCalendarEmployeeOptionsQueryDto,
  WorkforceCalendarEmployeeOptionsResponse,
  WorkforceCalendarFilterDto,
  WorkforceCalendarResponse,
} from './dto';
import {
  CalendarVisibility,
  ReportingTeamScopeService,
} from './reporting-team-scope.service';
import { calculatePrivacyState } from './workforce-calendar.privacy';

const MAX_CALENDAR_DAYS = 62;

const ACTIVE_LEAVE_STATUSES = [
  LeaveRequestStatus.SUBMITTED,
  LeaveRequestStatus.APPROVED,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
] as const;

type HolidayProjection = {
  holidayDate: Date;
  companyId: string;
  branchId: string | null;
  dayPortion: DayPortion;
  holidayName: string | null;
  source: 'LEGACY_HOLIDAYS' | 'BUSINESS_CALENDAR';
  calendarId: string | null;
};

@Injectable()
export class WorkforceCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
    private readonly reportingTeamScope: ReportingTeamScopeService,
    private readonly calendarConsumer: BusinessCalendarConsumerService,
  ) {}

  async getCalendar(
    actor: AuthenticatedUser,
    filters: WorkforceCalendarFilterDto,
  ): Promise<WorkforceCalendarResponse> {
    const visibility = await this.reportingTeamScope.resolveVisibility(actor);
    const { fromDate, toDate, dates } = this.assertDateRange(
      filters.fromDate,
      filters.toDate,
    );

    await this.assertNarrowingFilters(filters);

    let employeeIds = visibility.employeeIds;
    if (filters.employeeId) {
      await this.reportingTeamScope.assertEmployeeVisible(
        actor,
        filters.employeeId,
      );
      employeeIds = [filters.employeeId];
    }

    const employees = await this.loadEmployees({
      employeeIds,
      branchId: filters.branchId,
      departmentId: filters.departmentId,
    });

    if (employees.length === 0) {
      return {
        fromDate: filters.fromDate.slice(0, 10),
        toDate: filters.toDate.slice(0, 10),
        accessMode: visibility.mode,
        days: dates.map((date) => ({ date, employees: [] })),
      };
    }

    const scopedEmployeeIds = employees.map((e) => e.id);
    const companyIds = [...new Set(employees.map((e) => e.companyId))];
    const branchIds = [
      ...new Set(
        filters.branchId
          ? [filters.branchId]
          : employees.map((e) => e.branchId),
      ),
    ];

    const [rosterEntries, holidays, leaveRequests, attendances, overtime] =
      await Promise.all([
        this.prisma.shiftRosterEntry.findMany({
          where: {
            employeeId: { in: scopedEmployeeIds },
            workDate: { gte: fromDate, lte: toDate },
            shiftRoster: {
              status: {
                in: [ShiftRosterStatus.PUBLISHED, ShiftRosterStatus.LOCKED],
              },
            },
          },
          include: {
            shift: { select: { id: true, shiftName: true } },
          },
        }),
        this.loadHolidayProjections({
          companyIds,
          branchIds,
          fromDate,
          toDate,
          fromKey: filters.fromDate.slice(0, 10),
          toKey: filters.toDate.slice(0, 10),
        }),
        this.prisma.leaveRequest.findMany({
          where: {
            employeeId: { in: scopedEmployeeIds },
            isActive: true,
            status: { in: [...ACTIVE_LEAVE_STATUSES] },
            fromDate: { lte: toDate },
            toDate: { gte: fromDate },
          },
          include: {
            leaveType: { select: { id: true, leaveName: true } },
            approvalTransaction: {
              select: {
                currentStep: true,
                status: true,
                workflow: {
                  select: {
                    steps: {
                      select: {
                        stepNo: true,
                        approverType: true,
                        approverRole: true,
                      },
                    },
                  },
                },
                approvalSteps: {
                  select: {
                    stepNo: true,
                    status: true,
                    approverId: true,
                    actionDate: true,
                  },
                },
              },
            },
          },
        }),
        this.prisma.attendance.findMany({
          where: {
            employeeId: { in: scopedEmployeeIds },
            isActive: true,
            attendanceDate: { gte: fromDate, lte: toDate },
          },
        }),
        visibility.mode === 'SELF'
          ? this.prisma.overtimeRequest.findMany({
              where: {
                employeeId: { in: scopedEmployeeIds },
                businessDate: { gte: fromDate, lte: toDate },
              },
              select: {
                employeeId: true,
                businessDate: true,
                status: true,
              },
            })
          : Promise.resolve([]),
      ]);

    const days = dates.map((date) =>
      this.assembleDay({
        date,
        employees,
        actorEmployeeId: actor.employeeId ?? null,
        visibility,
        rosterEntries,
        holidays,
        leaveRequests,
        attendances,
        overtime,
        stateFilter: filters.state,
      }),
    );

    return {
      fromDate: filters.fromDate.slice(0, 10),
      toDate: filters.toDate.slice(0, 10),
      accessMode: visibility.mode,
      days,
    };
  }

  async getSelfCalendar(
    actor: AuthenticatedUser,
    filters: Pick<WorkforceCalendarFilterDto, 'fromDate' | 'toDate' | 'state'>,
  ) {
    if (!actor.employeeId) {
      throw new BadRequestException('Employee link required');
    }
    return this.getCalendar(actor, {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      employeeId: actor.employeeId,
      state: filters.state,
    });
  }

  async getTeamCalendar(
    actor: AuthenticatedUser,
    filters: Pick<
      WorkforceCalendarFilterDto,
      'fromDate' | 'toDate' | 'employeeId' | 'state'
    >,
  ) {
    const visibility = await this.reportingTeamScope.resolveVisibility(actor);
    if (visibility.mode === 'SELF') {
      throw new ForbiddenException(
        'Team calendar requires team or HR calendar permission',
      );
    }
    return this.getCalendar(actor, filters);
  }

  async listEmployeeOptions(
    actor: AuthenticatedUser,
    filters: WorkforceCalendarEmployeeOptionsQueryDto,
  ): Promise<WorkforceCalendarEmployeeOptionsResponse> {
    const visibility = await this.reportingTeamScope.resolveVisibility(actor);
    await this.assertNarrowingFilters(filters);

    const employees = await this.loadEmployees({
      employeeIds: visibility.employeeIds,
      branchId: filters.branchId,
      departmentId: filters.departmentId,
      search: filters.q,
    });

    return {
      accessMode: visibility.mode,
      items: employees.map((employee) => ({
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: [employee.firstName, employee.lastName]
          .filter(Boolean)
          .join(' '),
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        isSelf: actor.employeeId === employee.id,
      })),
    };
  }

  /**
   * Holiday load for personal/team calendars.
   * Prefer materialized runtime (or preview-fill) whenever an office
   * business calendar exists — not only ACTIVE — so published holidays
   * match Quick day check / roster generation under LEGACY offices.
   */
  private async loadHolidayProjections(input: {
    companyIds: string[];
    branchIds: string[];
    fromDate: Date;
    toDate: Date;
    fromKey: string;
    toKey: string;
  }): Promise<HolidayProjection[]> {
    if (input.branchIds.length === 0) {
      return [];
    }

    const [branches, calendars] = await Promise.all([
      this.prisma.branch.findMany({
        where: { id: { in: input.branchIds } },
        select: { id: true, companyId: true },
      }),
      this.prisma.businessCalendar.findMany({
        where: {
          isActive: true,
          OR: [
            {
              companyId: { in: input.companyIds },
              scope: BusinessCalendarScope.COMPANY,
            },
            {
              branchId: { in: input.branchIds },
              scope: BusinessCalendarScope.BRANCH,
            },
          ],
        },
        select: {
          id: true,
          companyId: true,
          branchId: true,
          scope: true,
          scopeKey: true,
          runtimeMode: true,
        },
      }),
    ]);

    const activeBranches: Array<{
      id: string;
      companyId: string;
      scopeKey: string;
      calendarId: string;
    }> = [];
    const legacyBranchIds: string[] = [];
    const legacyCalendarByBranch = new Map<string, string | null>();
    const legacyBranchesByCompany = new Map<string, string[]>();
    const activeCompanyIds = new Set<string>();

    for (const branch of branches) {
      const branchCalendar = calendars.find(
        (row) =>
          row.scope === BusinessCalendarScope.BRANCH &&
          row.branchId === branch.id,
      );
      const companyCalendar = calendars.find(
        (row) =>
          row.scope === BusinessCalendarScope.COMPANY &&
          row.companyId === branch.companyId,
      );
      const office = branchCalendar ?? companyCalendar;
      if (office) {
        activeCompanyIds.add(branch.companyId);
        activeBranches.push({
          id: branch.id,
          companyId: branch.companyId,
          scopeKey: office.scopeKey,
          calendarId: office.id,
        });
      } else {
        legacyBranchIds.push(branch.id);
        legacyCalendarByBranch.set(branch.id, null);
        const companyLegacyBranches =
          legacyBranchesByCompany.get(branch.companyId) ?? [];
        companyLegacyBranches.push(branch.id);
        legacyBranchesByCompany.set(branch.companyId, companyLegacyBranches);
      }
    }

    const projections: HolidayProjection[] = [];
    const covered = new Set<string>();

    if (activeBranches.length > 0) {
      const scopeKeys = [...new Set(activeBranches.map((row) => row.scopeKey))];
      const rangeKeys = eachDateInclusive(input.fromDate, input.toDate).map(
        (date) => date.toISOString().slice(0, 10),
      );

      const runtimeRows = await this.prisma.businessCalendarRuntimeDay.findMany(
        {
          where: {
            officeScopeKey: { in: scopeKeys },
            businessDate: { gte: input.fromDate, lte: input.toDate },
            isCurrent: true,
          },
          select: {
            officeScopeKey: true,
            businessDate: true,
            dayStatus: true,
            dayPortion: true,
            reasonCode: true,
            reasonText: true,
          },
        },
      );

      const rowsByScope = new Map<string, typeof runtimeRows>();
      for (const row of runtimeRows) {
        const list = rowsByScope.get(row.officeScopeKey) ?? [];
        list.push(row);
        rowsByScope.set(row.officeScopeKey, list);
      }

      for (const branch of activeBranches) {
        const rows = rowsByScope.get(branch.scopeKey) ?? [];
        const presentKeys = new Set(
          rows.map((row) => row.businessDate.toISOString().slice(0, 10)),
        );
        const coverageComplete = rangeKeys.every((key) => presentKeys.has(key));

        if (coverageComplete) {
          for (const row of rows) {
            if (
              !isHolidayRuntimeDay({
                dayStatus: row.dayStatus,
                dayPortion: row.dayPortion,
                reasonCode: row.reasonCode,
              })
            ) {
              continue;
            }
            const dateKey = row.businessDate.toISOString().slice(0, 10);
            const coverKey = `${branch.id}:${dateKey}`;
            if (covered.has(coverKey)) continue;
            covered.add(coverKey);
            projections.push({
              holidayDate: row.businessDate,
              companyId: branch.companyId,
              branchId: branch.id,
              dayPortion: row.dayPortion,
              holidayName: row.reasonText || null,
              source: 'BUSINESS_CALENDAR',
              calendarId: branch.calendarId,
            });
          }
          continue;
        }

        const resolved = await this.calendarConsumer.resolveConsumerDays({
          companyId: branch.companyId,
          branchId: branch.id,
          from: input.fromKey,
          to: input.toKey,
          materialize: false,
        });
        for (const day of resolved.values()) {
          if (day.kind !== 'HOLIDAY') continue;
          const coverKey = `${branch.id}:${day.date}`;
          if (covered.has(coverKey)) continue;
          covered.add(coverKey);
          projections.push({
            holidayDate: new Date(`${day.date}T00:00:00.000Z`),
            companyId: branch.companyId,
            branchId: branch.id,
            dayPortion: day.dayPortion,
            holidayName: day.reasonText || null,
            source: 'BUSINESS_CALENDAR',
            calendarId: branch.calendarId,
          });
        }
      }
    }

    if (
      legacyBranchIds.length > 0 ||
      activeCompanyIds.size < input.companyIds.length
    ) {
      const fullyLegacyCompanyIds = input.companyIds.filter(
        (id) => !activeCompanyIds.has(id),
      );
      const legacyCompanyIdsForCompanyWideHolidays = [
        ...new Set([
          ...fullyLegacyCompanyIds,
          ...legacyBranchesByCompany.keys(),
        ]),
      ];
      const legacyHolidays = await this.prisma.holiday.findMany({
        where: {
          isActive: true,
          holidayDate: { gte: input.fromDate, lte: input.toDate },
          OR: [
            ...(legacyCompanyIdsForCompanyWideHolidays.length
              ? [
                  {
                    companyId: { in: legacyCompanyIdsForCompanyWideHolidays },
                    branchId: null,
                  },
                ]
              : []),
            ...(legacyBranchIds.length
              ? [{ branchId: { in: legacyBranchIds } }]
              : []),
          ],
        },
        select: {
          holidayDate: true,
          companyId: true,
          branchId: true,
          dayPortion: true,
          holidayName: true,
        },
      });

      for (const row of legacyHolidays) {
        if (row.branchId) {
          projections.push({
            holidayDate: row.holidayDate,
            companyId: row.companyId,
            branchId: row.branchId,
            dayPortion: row.dayPortion,
            holidayName: row.holidayName,
            source: 'LEGACY_HOLIDAYS',
            calendarId: legacyCalendarByBranch.get(row.branchId) ?? null,
          });
          continue;
        }

        const targetBranchIds =
          legacyBranchesByCompany.get(row.companyId) ?? [];
        for (const branchId of targetBranchIds) {
          projections.push({
            holidayDate: row.holidayDate,
            companyId: row.companyId,
            branchId,
            dayPortion: row.dayPortion,
            holidayName: row.holidayName,
            source: 'LEGACY_HOLIDAYS',
            calendarId: legacyCalendarByBranch.get(branchId) ?? null,
          });
        }
      }
    }

    return projections;
  }

  private assembleDay(params: {
    date: string;
    employees: Array<{
      id: string;
      employeeCode: string;
      firstName: string;
      lastName: string | null;
      companyId: string;
      branchId: string;
      departmentId: string;
    }>;
    actorEmployeeId: string | null;
    visibility: CalendarVisibility;
    rosterEntries: Array<{
      employeeId: string;
      workDate: Date;
      dayType: ShiftRosterDayType;
      dayPortion: string;
      scheduledStartAt: Date | null;
      scheduledEndAt: Date | null;
      shift: { id: string; shiftName: string } | null;
    }>;
    holidays: Array<{
      holidayDate: Date;
      companyId: string;
      branchId: string | null;
      dayPortion: string;
      holidayName: string | null;
      source?: 'LEGACY_HOLIDAYS' | 'BUSINESS_CALENDAR';
      calendarId?: string | null;
    }>;
    leaveRequests: Array<{
      employeeId: string;
      fromDate: Date;
      toDate: Date;
      status: string;
      isHalfDay: boolean;
      leaveType: { id: string; leaveName: string } | null;
      approvalTransaction?: {
        currentStep: number;
        status: string;
        workflow?: {
          steps: Array<{
            stepNo: number;
            approverType: string;
            approverRole: string | null;
          }>;
        } | null;
        approvalSteps: Array<{
          stepNo: number;
          status: string;
          approverId: string | null;
          actionDate: Date | null;
        }>;
      } | null;
    }>;
    attendances: Array<{
      employeeId: string;
      attendanceDate: Date;
      status: string;
    }>;
    overtime: Array<{
      employeeId: string;
      businessDate: Date;
      status: string;
    }>;
    stateFilter?: string;
  }): WorkforceCalendarDay {
    const dateKey = params.date;
    const employees: WorkforceCalendarEmployeeDay[] = [];

    for (const employee of params.employees) {
      const isSelf = params.actorEmployeeId === employee.id;
      const showDetail =
        isSelf ||
        params.visibility.canViewOperationalDetail ||
        params.visibility.mode === 'TENANT' ||
        params.visibility.mode === 'GLOBAL';

      const roster = params.rosterEntries.find(
        (row) =>
          row.employeeId === employee.id &&
          this.toDateKey(row.workDate) === dateKey,
      );
      const holiday = params.holidays.find((row) => {
        if (this.toDateKey(row.holidayDate) !== dateKey) return false;
        if (row.branchId) return row.branchId === employee.branchId;
        return row.companyId === employee.companyId;
      });
      const leave = params.leaveRequests.find(
        (row) =>
          row.employeeId === employee.id &&
          this.toDateKey(row.fromDate) <= dateKey &&
          this.toDateKey(row.toDate) >= dateKey,
      );
      const attendance = params.attendances.find(
        (row) =>
          row.employeeId === employee.id &&
          this.toDateKey(row.attendanceDate) === dateKey,
      );
      const ot = params.overtime.find(
        (row) =>
          row.employeeId === employee.id &&
          this.toDateKey(row.businessDate) === dateKey,
      );

      const state = calculatePrivacyState({
        rosterDayType: roster?.dayType ?? null,
        holiday: Boolean(holiday),
        leaveStatus: leave?.status ?? null,
        attendanceStatus: attendance?.status ?? null,
      });

      if (params.stateFilter && state !== params.stateFilter) {
        continue;
      }

      const entry: WorkforceCalendarEmployeeDay = {
        employeeId: employee.id,
        employeeCode: employee.employeeCode,
        fullName: [employee.firstName, employee.lastName]
          .filter(Boolean)
          .join(' '),
        departmentId: employee.departmentId,
        branchId: employee.branchId,
        state,
        dayType: roster?.dayType ?? (holiday ? 'HOLIDAY' : null),
        portion: leave?.isHalfDay
          ? 'HALF_DAY'
          : (roster?.dayPortion ?? holiday?.dayPortion ?? null),
        isSelf,
      };

      if (showDetail) {
        entry.shiftName = roster?.shift?.shiftName ?? null;
        entry.scheduledStartAt =
          roster?.scheduledStartAt?.toISOString() ?? null;
        entry.scheduledEndAt = roster?.scheduledEndAt?.toISOString() ?? null;
        entry.attendanceStatus = attendance?.status ?? null;
        entry.leaveStatus = leave?.status ?? null;
        entry.leaveTypeName = leave?.leaveType?.leaveName ?? null;
        entry.leaveTypeId = leave?.leaveType?.id ?? null;
        entry.dayPortion = entry.portion;
        entry.holidayName = holiday?.holidayName ?? null;
        entry.holidaySource = holiday?.source ?? null;
        entry.holidayCalendarId = holiday?.calendarId ?? null;
        entry.approvalStage = leave
          ? leaveCalendarApprovalStage({
              status: leave.status,
              approvalTransaction: leave.approvalTransaction,
            })
          : null;
        if (isSelf) {
          entry.overtimeStatus = ot?.status ?? null;
        }
      }

      employees.push(entry);
    }

    return { date: dateKey, employees };
  }

  private async assertNarrowingFilters(filters: {
    branchId?: string;
    departmentId?: string;
  }) {
    if (filters.branchId) {
      await this.employeeDomainScope.assertBranchInScope(filters.branchId);
    }
    if (filters.departmentId) {
      await this.employeeDomainScope.assertDepartmentInScope(
        filters.departmentId,
        undefined,
        filters.branchId,
      );
    }
  }

  private async loadEmployees(params: {
    employeeIds: string[] | null;
    branchId?: string;
    departmentId?: string;
    search?: string;
  }) {
    const where: Prisma.EmployeeWhereInput = {
      isActive: true,
      employmentStatus: 'ACTIVE',
      ...this.employeeDomainScope.employeeWhere(),
    };
    if (params.employeeIds) {
      where.id = { in: params.employeeIds };
    }
    if (params.branchId) where.branchId = params.branchId;
    if (params.departmentId) where.departmentId = params.departmentId;
    const search = params.search?.trim();
    if (search) {
      where.OR = [
        { employeeCode: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.employee.findMany({
      where,
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        companyId: true,
        branchId: true,
        departmentId: true,
      },
      orderBy: { employeeCode: 'asc' },
      take: 500,
    });
  }

  private assertDateRange(from: string, to: string) {
    const fromDate = this.parseDateOnly(from);
    const toDate = this.parseDateOnly(to);
    if (toDate < fromDate) {
      throw new BadRequestException('toDate must be on or after fromDate');
    }
    const days =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
    if (days > MAX_CALENDAR_DAYS) {
      throw new ConflictException({
        code: WorkforceTimeErrorCode.ROSTER_PERIOD_TOO_LONG,
        message: `Calendar range cannot exceed ${MAX_CALENDAR_DAYS} days`,
      });
    }

    const dates: string[] = [];
    const cursor = new Date(fromDate);
    while (cursor <= toDate) {
      dates.push(this.toDateKey(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return { fromDate, toDate, dates };
  }

  private parseDateOnly(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) {
      throw new BadRequestException('Invalid date; expected YYYY-MM-DD');
    }
    return new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
    );
  }

  private toDateKey(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
