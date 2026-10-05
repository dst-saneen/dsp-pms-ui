import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  BusinessDayEffect,
  BusinessDayStatus,
  DayPortion,
  Prisma,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import {
  LeaveRequestStatus,
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
} from '../employee-leave/constants/leave-status.constants';
import {
  isValidIanaTimeZone,
  toCalendarDate,
} from '../leave-policy/leave-calendar.util';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import {
  eachDateInclusive,
  resolveBusinessDay,
  type RuntimeEvent,
  type RuntimeWeekRule,
} from './business-calendar-runtime.util';

export type OptionalHolidaySelectionStatus =
  | 'NONE'
  | 'SUBMITTED'
  | 'APPROVED';

export type OptionalHolidayCatalogHoliday = {
  eventId: string;
  date: string;
  name: string;
  calendarScope: 'COMPANY' | 'BRANCH';
  selected: boolean;
  /** Active leave status for this pick (none / awaiting approval / approved). */
  selectionStatus: OptionalHolidaySelectionStatus;
  locked: boolean;
  editableUntil: string;
};

export type OptionalHolidayCatalog = {
  year: number;
  timezone: string;
  maximumHolidayDays: number;
  mandatoryWorkingDayCount: number;
  optionalAllowance: number;
  selectedCount: number;
  remainingCount: number;
  holidays: OptionalHolidayCatalogHoliday[];
};

type CatalogEvent = RuntimeEvent & {
  isOptionalHoliday: boolean;
  eventTypeCode: string;
  allDay: boolean;
};

type CatalogVersion = {
  id: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  contentChecksum: string;
  workingWeekRules: RuntimeWeekRule[];
  events: CatalogEvent[];
  scope: BusinessCalendarScope;
};

type DateOccurrence = {
  eventId: string;
  name: string;
  date: string;
  isOptionalHoliday: boolean;
  businessDayEffect: BusinessDayEffect;
  eventTypeCode: string;
  allDay: boolean;
  calendarScope: 'COMPANY' | 'BRANCH';
};

const FULL_DAY_NON_WORKING = BusinessDayEffect.NON_WORKING_DAY;

@Injectable()
export class OptionalHolidayCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  async getCatalog(input: {
    employeeId: string;
    year: number;
    /** Override "now" for lock tests (defaults to current instant). */
    asOf?: Date;
    client?: Prisma.TransactionClient;
  }): Promise<OptionalHolidayCatalog> {
    const db = input.client ?? this.prisma;
    this.assertYear(input.year);

    const employee = await db.employee.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        isActive: true,
        companyId: true,
        branchId: true,
        branch: { select: { id: true, timezone: true } },
      },
    });

    if (!employee || !employee.isActive) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Employee not found',
      });
    }

    const timezone = employee.branch.timezone;
    if (!timezone || !isValidIanaTimeZone(timezone)) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_TIMEZONE_INVALID,
        message: 'Employee branch timezone is missing or invalid',
      });
    }

    const policy = await db.companyHolidayPolicy.findFirst({
      where: {
        companyId: employee.companyId,
        year: input.year,
        isActive: true,
      },
    });

    if (!policy) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: `No active holiday policy for company year ${input.year}`,
      });
    }

    const yearFrom = this.parseDate(`${input.year}-01-01`);
    const yearTo = this.parseDate(`${input.year}-12-31`);

    const companyCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId: employee.companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
      select: { id: true },
    });

    if (!companyCalendar) {
      throw new NotFoundException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Active company business calendar not found',
      });
    }

    const branchCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId: employee.companyId,
        branchId: employee.branchId,
        scope: BusinessCalendarScope.BRANCH,
        isActive: true,
      },
      select: { id: true },
    });

    const companyVersions = await this.loadPublishedVersions(
      db,
      companyCalendar.id,
      yearFrom,
      yearTo,
    );
    const branchVersions = branchCalendar
      ? await this.loadPublishedVersions(
          db,
          branchCalendar.id,
          yearFrom,
          yearTo,
        )
      : [];

    const companyId = employee.companyId;
    const branchId = employee.branchId;

    const occurrences = this.collectOccurrences({
      companyId,
      branchId,
      yearFrom,
      yearTo,
      companyVersions,
      branchVersions,
    });

    const dates = [...occurrences.keys()].sort();
    let mandatoryWorkingDayCount = 0;
    const optionalCandidates: DateOccurrence[] = [];

    for (const dateKey of dates) {
      const dayOccurrences = occurrences.get(dateKey) ?? [];
      const businessDate = this.parseDate(dateKey);
      const companyVersion = this.pickEffectiveVersion(
        companyVersions,
        businessDate,
      );
      const branchVersion = this.pickEffectiveVersion(
        branchVersions,
        businessDate,
      );

      const mandatory = dayOccurrences.find((row) =>
        this.isMandatoryHoliday(row),
      );
      if (mandatory) {
        if (
          this.isBaseWorkingDay({
            businessDate,
            companyWeekRules: companyVersion?.workingWeekRules ?? [],
            branchWeekRules: branchVersion?.workingWeekRules,
            branchId,
          })
        ) {
          mandatoryWorkingDayCount += 1;
        }
        continue;
      }

      const optional = this.pickOptionalOccurrence(dayOccurrences);
      if (!optional) continue;

      const resolved = resolveBusinessDay({
        companyId,
        branchId,
        businessDate,
        companyWeekRules: companyVersion?.workingWeekRules ?? [],
        companyEvents: this.toRuntimeEvents(companyVersion?.events ?? []),
        branchWeekRules: branchVersion?.workingWeekRules,
        branchEvents: this.toRuntimeEvents(branchVersion?.events ?? []),
        sourceChecksum:
          branchVersion?.contentChecksum ??
          companyVersion?.contentChecksum ??
          'none',
      });

      if (
        resolved.dayStatus === BusinessDayStatus.WORKING &&
        resolved.dayPortion === DayPortion.FULL_DAY
      ) {
        optionalCandidates.push(optional);
      }
    }

    if (mandatoryWorkingDayCount > policy.maximumHolidayDays) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.HOLIDAY_POLICY_MAX_BELOW_MANDATORY,
        message:
          'Company holiday maximum is below the mandatory working-day holiday count. Ask HR to open Administration → Business Calendar → Annual holiday policy and raise Maximum holidays, or remove some Mandatory holidays from the calendar and publish.',
      });
    }

    const optionalAllowance = Math.max(
      0,
      policy.maximumHolidayDays - mandatoryWorkingDayCount,
    );

    const selectedRows = await db.leaveRequest.findMany({
      where: {
        employeeId: employee.id,
        companyId: employee.companyId,
        optionalHolidayEventId: { not: null },
        status: {
          in: [
            LeaveRequestStatus.SUBMITTED,
            LeaveRequestStatus.APPROVED,
            LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
          ],
        },
        isActive: true,
        fromDate: { gte: yearFrom, lte: yearTo },
      },
      select: { optionalHolidayEventId: true, status: true },
    });

    const selectedByEvent = new Map<
      string,
      OptionalHolidaySelectionStatus
    >();
    for (const row of selectedRows) {
      if (!row.optionalHolidayEventId) continue;
      const status: OptionalHolidaySelectionStatus =
        row.status === LeaveRequestStatus.APPROVED ? 'APPROVED' : 'SUBMITTED';
      const prior = selectedByEvent.get(row.optionalHolidayEventId);
      // Prefer APPROVED if both somehow exist.
      if (prior === 'APPROVED') continue;
      selectedByEvent.set(row.optionalHolidayEventId, status);
    }

    const asOf = input.asOf ?? new Date();
    const branchBusinessDate = toCalendarDate(asOf, timezone);

    const holidays = optionalCandidates.map((row) => {
      const locked = branchBusinessDate >= row.date;
      const selectionStatus = selectedByEvent.get(row.eventId) ?? 'NONE';
      return {
        eventId: row.eventId,
        date: row.date,
        name: row.name,
        calendarScope: row.calendarScope,
        selected: selectionStatus !== 'NONE',
        selectionStatus,
        locked,
        editableUntil: `${subtractOneCalendarDay(row.date)}T23:59:59`,
      };
    });

    const selectedCount = holidays.filter((row) => row.selected).length;
    const remainingCount = Math.max(0, optionalAllowance - selectedCount);

    return {
      year: input.year,
      timezone,
      maximumHolidayDays: policy.maximumHolidayDays,
      mandatoryWorkingDayCount,
      optionalAllowance,
      selectedCount,
      remainingCount,
      holidays,
    };
  }

  /**
   * HR-facing check: company policy vs mandatory working-day holidays
   * across company + branch calendars (worst branch drives the conflict).
   */
  async getSetupStatus(
    companyId: string,
    year: number,
  ): Promise<{
    companyId: string;
    year: number;
    policyConfigured: boolean;
    maximumHolidayDays: number | null;
    mandatoryWorkingDayCount: number;
    optionalAllowance: number | null;
    minimumMaximumNeeded: number;
    conflict: boolean;
    message: string | null;
    fixPath: string;
  }> {
    await this.employeeDomainScope.assertCompanyInScope(companyId);

    const fixPath = '/administration/business-calendar#annual-holiday-policy';

    const policy = await this.prisma.companyHolidayPolicy.findFirst({
      where: { companyId, year, isActive: true },
      select: { maximumHolidayDays: true },
    });

    const yearFrom = this.parseDate(`${year}-01-01`);
    const yearTo = this.parseDate(`${year}-12-31`);

    const companyCalendar = await this.prisma.businessCalendar.findFirst({
      where: {
        companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
      select: { id: true },
    });

    if (!companyCalendar) {
      return {
        companyId,
        year,
        policyConfigured: Boolean(policy),
        maximumHolidayDays: policy?.maximumHolidayDays ?? null,
        mandatoryWorkingDayCount: 0,
        optionalAllowance: policy?.maximumHolidayDays ?? null,
        minimumMaximumNeeded: 0,
        conflict: false,
        message: policy
          ? null
          : 'Create an annual holiday policy and a company calendar before employees can select optional holidays.',
        fixPath,
      };
    }

    const companyVersions = await this.loadPublishedVersions(
      this.prisma,
      companyCalendar.id,
      yearFrom,
      yearTo,
    );

    const branchCalendars = await this.prisma.businessCalendar.findMany({
      where: {
        companyId,
        scope: BusinessCalendarScope.BRANCH,
        isActive: true,
        branchId: { not: null },
      },
      select: { id: true, branchId: true },
      take: 200,
    });

    let mandatoryWorkingDayCount = this.countMandatoryWorkingDays({
      companyId,
      branchId: null,
      yearFrom,
      yearTo,
      companyVersions,
      branchVersions: [],
    });

    for (const branchCalendar of branchCalendars) {
      if (!branchCalendar.branchId) continue;
      const branchVersions = await this.loadPublishedVersions(
        this.prisma,
        branchCalendar.id,
        yearFrom,
        yearTo,
      );
      const count = this.countMandatoryWorkingDays({
        companyId,
        branchId: branchCalendar.branchId,
        yearFrom,
        yearTo,
        companyVersions,
        branchVersions,
      });
      if (count > mandatoryWorkingDayCount) {
        mandatoryWorkingDayCount = count;
      }
    }

    if (!policy) {
      return {
        companyId,
        year,
        policyConfigured: false,
        maximumHolidayDays: null,
        mandatoryWorkingDayCount,
        optionalAllowance: null,
        minimumMaximumNeeded: mandatoryWorkingDayCount,
        conflict: false,
        message:
          'No annual holiday policy for this year. Set Maximum holidays and link the Optional Holiday leave type below.',
        fixPath,
      };
    }

    const conflict = mandatoryWorkingDayCount > policy.maximumHolidayDays;
    const optionalAllowance = Math.max(
      0,
      policy.maximumHolidayDays - mandatoryWorkingDayCount,
    );
    const minimumMaximumNeeded = mandatoryWorkingDayCount;

    return {
      companyId,
      year,
      policyConfigured: true,
      maximumHolidayDays: policy.maximumHolidayDays,
      mandatoryWorkingDayCount,
      optionalAllowance: conflict ? 0 : optionalAllowance,
      minimumMaximumNeeded,
      conflict,
      message: conflict
        ? `Your Maximum is too low for the Mandatory holidays already on the calendar.`
        : null,
      fixPath,
    };
  }

  private countMandatoryWorkingDays(input: {
    companyId: string;
    branchId: string | null;
    yearFrom: Date;
    yearTo: Date;
    companyVersions: CatalogVersion[];
    branchVersions: CatalogVersion[];
  }): number {
    const branchId = input.branchId ?? 'company';
    const occurrences = this.collectOccurrences({
      companyId: input.companyId,
      branchId,
      yearFrom: input.yearFrom,
      yearTo: input.yearTo,
      companyVersions: input.companyVersions,
      branchVersions: input.branchVersions,
    });

    let mandatoryWorkingDayCount = 0;
    for (const dateKey of occurrences.keys()) {
      const dayOccurrences = occurrences.get(dateKey) ?? [];
      const businessDate = this.parseDate(dateKey);
      const companyVersion = this.pickEffectiveVersion(
        input.companyVersions,
        businessDate,
      );
      const branchVersion = this.pickEffectiveVersion(
        input.branchVersions,
        businessDate,
      );
      const mandatory = dayOccurrences.find((row) =>
        this.isMandatoryHoliday(row),
      );
      if (
        mandatory &&
        this.isBaseWorkingDay({
          businessDate,
          companyWeekRules: companyVersion?.workingWeekRules ?? [],
          branchWeekRules: branchVersion?.workingWeekRules,
          branchId: input.branchId,
        })
      ) {
        mandatoryWorkingDayCount += 1;
      }
    }
    return mandatoryWorkingDayCount;
  }

  private collectOccurrences(input: {
    companyId: string;
    branchId: string;
    yearFrom: Date;
    yearTo: Date;
    companyVersions: CatalogVersion[];
    branchVersions: CatalogVersion[];
  }): Map<string, DateOccurrence[]> {
    const map = new Map<string, DateOccurrence[]>();

    const pushVersion = (
      versions: CatalogVersion[],
      calendarScope: 'COMPANY' | 'BRANCH',
    ) => {
      for (const version of versions) {
        for (const event of version.events) {
          if (event.eventTypeCode !== 'HOLIDAY') continue;
          if (!this.appliesToOffice(event, input.companyId, input.branchId)) {
            continue;
          }

          for (const day of eachDateInclusive(event.startDate, event.endDate)) {
            if (day < input.yearFrom || day > input.yearTo) continue;
            if (!this.versionCoversDate(version, day)) continue;
            const date = day.toISOString().slice(0, 10);
            const bucket = map.get(date) ?? [];
            bucket.push({
              eventId: event.id,
              name: event.eventName,
              date,
              isOptionalHoliday: event.isOptionalHoliday,
              businessDayEffect: event.businessDayEffect,
              eventTypeCode: event.eventTypeCode,
              allDay: event.allDay,
              calendarScope,
            });
            map.set(date, bucket);
          }
        }
      }
    };

    pushVersion(input.companyVersions, 'COMPANY');
    pushVersion(input.branchVersions, 'BRANCH');
    return map;
  }

  private isMandatoryHoliday(row: DateOccurrence): boolean {
    return (
      !row.isOptionalHoliday &&
      row.eventTypeCode === 'HOLIDAY' &&
      row.allDay &&
      row.businessDayEffect === FULL_DAY_NON_WORKING
    );
  }

  private pickOptionalOccurrence(
    rows: DateOccurrence[],
  ): DateOccurrence | undefined {
    const optionals = rows.filter(
      (row) =>
        row.isOptionalHoliday &&
        row.eventTypeCode === 'HOLIDAY' &&
        row.allDay &&
        row.businessDayEffect === BusinessDayEffect.NONE,
    );
    if (optionals.length === 0) return undefined;
    const branch = optionals.find((row) => row.calendarScope === 'BRANCH');
    return branch ?? optionals[0];
  }

  private isBaseWorkingDay(input: {
    businessDate: Date;
    companyWeekRules: RuntimeWeekRule[];
    branchWeekRules?: RuntimeWeekRule[];
    branchId: string | null;
  }): boolean {
    const dayOfWeek = input.businessDate.getUTCDay();
    if (input.branchId && input.branchWeekRules?.length) {
      const branchWeek = input.branchWeekRules.find(
        (rule) => rule.dayOfWeek === dayOfWeek,
      );
      if (branchWeek) return branchWeek.isWorkingDay;
    }
    const companyWeek = input.companyWeekRules.find(
      (rule) => rule.dayOfWeek === dayOfWeek,
    );
    return companyWeek?.isWorkingDay ?? false;
  }

  private toRuntimeEvents(events: CatalogEvent[]): RuntimeEvent[] {
    return events.map((event) => ({
      id: event.id,
      eventName: event.eventName,
      startDate: event.startDate,
      endDate: event.endDate,
      businessDayEffect: event.businessDayEffect,
      paidHoliday: event.paidHoliday,
      targets: event.targets,
    }));
  }

  private appliesToOffice(
    event: CatalogEvent,
    companyId: string,
    branchId: string | null,
  ): boolean {
    return event.targets.some((target) => {
      if (target.companyId !== companyId) return false;
      if (target.targetType === 'COMPANY') return true;
      if (target.targetType === 'BRANCH') {
        return !!branchId && target.branchId === branchId;
      }
      return false;
    });
  }

  private versionCoversDate(
    version: CatalogVersion,
    businessDate: Date,
  ): boolean {
    const time = businessDate.getTime();
    if (version.effectiveFrom.getTime() > time) return false;
    if (version.effectiveTo && version.effectiveTo.getTime() < time)
      return false;
    return true;
  }

  private pickEffectiveVersion(
    versions: CatalogVersion[],
    businessDate: Date,
  ): CatalogVersion | null {
    for (const version of versions) {
      if (this.versionCoversDate(version, businessDate)) return version;
    }
    return null;
  }

  private async loadPublishedVersions(
    db: Prisma.TransactionClient | PrismaService,
    calendarId: string,
    from: Date,
    to: Date,
  ): Promise<CatalogVersion[]> {
    const versions = await db.businessCalendarVersion.findMany({
      where: {
        calendarId,
        status: BusinessCalendarVersionStatus.PUBLISHED,
        effectiveFrom: { lte: to },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }],
      },
      orderBy: { versionNumber: 'desc' },
      include: {
        calendar: { select: { scope: true } },
        workingWeekRules: true,
        events: {
          include: {
            targets: true,
            eventType: { select: { eventTypeCode: true } },
          },
        },
      },
    });

    return versions.map((version) => ({
      id: version.id,
      effectiveFrom: version.effectiveFrom,
      effectiveTo: version.effectiveTo,
      contentChecksum: version.contentChecksum,
      scope: version.calendar.scope,
      workingWeekRules: version.workingWeekRules.map((rule) => ({
        dayOfWeek: rule.dayOfWeek,
        isWorkingDay: rule.isWorkingDay,
        dayPortion: rule.dayPortion,
        ruleMode: rule.ruleMode,
      })),
      events: version.events.map((event) => ({
        id: event.id,
        eventName: event.eventName,
        startDate: event.startDate,
        endDate: event.endDate,
        businessDayEffect: event.businessDayEffect,
        paidHoliday: event.paidHoliday,
        isOptionalHoliday: event.isOptionalHoliday,
        allDay: event.allDay,
        eventTypeCode: event.eventType.eventTypeCode,
        targets: event.targets.map((target) => ({
          targetType: target.targetType,
          companyId: target.companyId,
          branchId: target.branchId,
        })),
      })),
    }));
  }

  private parseDate(value: string): Date {
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }

  private assertYear(year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new BadRequestException({
        code: 'BAD_REQUEST',
        message: 'year must be between 2000 and 2100',
      });
    }
  }
}

export function subtractOneCalendarDay(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const prev = new Date(Date.UTC(year, month - 1, day - 1, 12, 0, 0));
  return prev.toISOString().slice(0, 10);
}
