import { Injectable } from '@nestjs/common';
import {
  DayPortion,
  Holiday,
  Shift,
  ShiftRosterDayType,
  ShiftRosterEntry,
  ShiftRosterEntrySource,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import {
  dayOfWeekForCalendarDate,
  enumerateCalendarDates,
  isValidIanaTimeZone,
} from '../leave-policy/leave-calendar.util';
import {
  calendarDateTimeToUtc,
  parseShiftDurationMinutes,
} from '../attendance/attendance-calendar.util';

import {
  assertRosterPeriodRange,
  calendarDateToDbDate,
  parseCalendarDateInput,
} from './shift-roster-period.util';
import {
  ShiftRosterGenerationEntry,
  ShiftRosterGenerationResult,
  ShiftRosterGenerationWarning,
} from './shift-roster.types';

type BranchContext = {
  id: string;
  companyId: string;
  timezone: string;
  workingCalendarReviewedAt: Date | null;
  workingDays: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    dayPortion: DayPortion;
  }>;
};

type EmployeeContext = {
  id: string;
  joiningDate: Date | null;
  lastWorkingDate: string | null;
};

type EmployeeShiftAssignment = {
  employeeId: string;
  shift: Shift;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

@Injectable()
export class ShiftRosterGenerationService {
  buildGenerationKey(
    rosterId: string,
    employeeId: string,
    workDate: string,
  ): string {
    return `${rosterId}:${employeeId}:${workDate}`;
  }

  generate(input: {
    branch: BranchContext;
    periodStart: string | Date;
    periodEnd: string | Date;
    rosterId: string;
    employees: EmployeeContext[];
    holidays: Holiday[];
    employeeShifts: EmployeeShiftAssignment[];
    existingEntries?: ShiftRosterEntry[];
    /** Company default / first active shift when employee has no assignment. */
    defaultShift?: Shift | null;
    /** When set (ACTIVE office), replaces Holiday + BranchWorkingDay classification. */
    runtimeDays?: Map<
      string,
      {
        dayType: ShiftRosterDayType;
        dayPortion: DayPortion;
        runtimeDayId: string | null;
      }
    >;
  }): ShiftRosterGenerationResult {
    const periodStart = parseCalendarDateInput(input.periodStart);
    const periodEnd = parseCalendarDateInput(input.periodEnd);
    assertRosterPeriodRange(periodStart, periodEnd);

    const timezone = input.branch.timezone.trim();
    const warnings: ShiftRosterGenerationWarning[] = [];
    const entries: ShiftRosterGenerationEntry[] = [];
    const includedEmployees: string[] = [];
    const excludedEmployees: Array<{ employeeId: string; reason: string }> = [];

    if (!timezone || !isValidIanaTimeZone(timezone)) {
      warnings.push({
        code: 'BRANCH_TIMEZONE_REQUIRED',
        message:
          'Branch timezone must be a valid IANA timezone before roster generation',
      });
    }

    if (!input.branch.workingCalendarReviewedAt) {
      warnings.push({
        code: WorkforceTimeErrorCode.BRANCH_CALENDAR_NOT_REVIEWED,
        message: 'Branch working calendar has not been reviewed',
      });
    }

    const workingDayMap = this.buildWorkingDayMap(input.branch.workingDays);
    const holidayMap = this.buildHolidayMap(input.holidays);
    const shiftMap = this.buildEmployeeShiftMap(input.employeeShifts);
    const existingByKey = new Map(
      (input.existingEntries ?? []).map((entry) => [
        this.buildGenerationKey(
          input.rosterId,
          entry.employeeId,
          parseCalendarDateInput(entry.workDate),
        ),
        entry,
      ]),
    );

    const dates = enumerateCalendarDates(periodStart, periodEnd);

    for (const employee of input.employees) {
      const employeeJoinDate = employee.joiningDate
        ? parseCalendarDateInput(employee.joiningDate)
        : null;
      const employeeLastDate = employee.lastWorkingDate;

      let hasAnyEntry = false;
      for (const workDate of dates) {
        if (employeeJoinDate && workDate < employeeJoinDate) {
          continue;
        }
        if (employeeLastDate && workDate > employeeLastDate) {
          continue;
        }

        hasAnyEntry = true;
        const generationKey = this.buildGenerationKey(
          input.rosterId,
          employee.id,
          workDate,
        );
        const existing = existingByKey.get(generationKey);

        if (existing?.source === ShiftRosterEntrySource.MANUAL_OVERRIDE) {
          entries.push({
            employeeId: employee.id,
            workDate,
            dayType: existing.dayType,
            dayPortion: existing.dayPortion,
            shiftId: existing.shiftId,
            scheduledStartAt: existing.scheduledStartAt,
            scheduledEndAt: existing.scheduledEndAt,
            breakMinutes: existing.breakMinutes,
            scheduledNetMinutes: existing.scheduledNetMinutes,
            timezone: existing.timezone,
            generationKey,
            source: ShiftRosterEntrySource.MANUAL_OVERRIDE,
            action: 'retain',
            existingEntryId: existing.id,
            businessCalendarRuntimeDayId:
              existing.businessCalendarRuntimeDayId ?? null,
          });
          continue;
        }

        const runtimeDay = input.runtimeDays?.get(workDate);

        if (runtimeDay) {
          if (runtimeDay.dayType !== ShiftRosterDayType.WORKING) {
            entries.push({
              ...this.buildNonWorkingEntry({
                employeeId: employee.id,
                workDate,
                rosterId: input.rosterId,
                timezone,
                dayType: runtimeDay.dayType,
                dayPortion: runtimeDay.dayPortion,
                existing,
              }),
              businessCalendarRuntimeDayId: runtimeDay.runtimeDayId,
            });
            continue;
          }
        } else {
          const holiday = holidayMap.get(workDate);
          if (holiday) {
            entries.push(
              this.buildNonWorkingEntry({
                employeeId: employee.id,
                workDate,
                rosterId: input.rosterId,
                timezone,
                dayType:
                  holiday.dayPortion === DayPortion.FULL_DAY
                    ? ShiftRosterDayType.HOLIDAY
                    : ShiftRosterDayType.SCHEDULED_HALF_DAY,
                dayPortion: holiday.dayPortion,
                existing,
              }),
            );
            continue;
          }

          const dayOfWeek = dayOfWeekForCalendarDate(workDate);
          const workingDay = workingDayMap.get(dayOfWeek);
          if (!workingDay || !workingDay.isWorkingDay) {
            entries.push(
              this.buildNonWorkingEntry({
                employeeId: employee.id,
                workDate,
                rosterId: input.rosterId,
                timezone,
                dayType: ShiftRosterDayType.WEEK_OFF,
                dayPortion: workingDay?.dayPortion ?? DayPortion.FULL_DAY,
                existing,
              }),
            );
            continue;
          }
        }

        const dayOfWeek = dayOfWeekForCalendarDate(workDate);
        const workingDay = workingDayMap.get(dayOfWeek);
        const dayPortion =
          runtimeDay?.dayPortion ??
          workingDay?.dayPortion ??
          DayPortion.FULL_DAY;

        const shift =
          this.resolveShiftForDate(shiftMap.get(employee.id) ?? [], workDate) ??
          input.defaultShift ??
          null;
        if (!shift) {
          warnings.push({
            code: WorkforceTimeErrorCode.SHIFT_ASSIGNMENT_REQUIRED,
            message:
              'No effective employee shift assignment (and no company default shift) for this date',
            employeeId: employee.id,
            workDate,
          });
          entries.push({
            employeeId: employee.id,
            workDate,
            dayType: ShiftRosterDayType.WEEK_OFF,
            dayPortion: DayPortion.FULL_DAY,
            shiftId: null,
            scheduledStartAt: null,
            scheduledEndAt: null,
            breakMinutes: 0,
            scheduledNetMinutes: 0,
            timezone,
            generationKey,
            source: ShiftRosterEntrySource.GENERATED,
            action: existing ? 'delete' : 'skip',
            existingEntryId: existing?.id,
            businessCalendarRuntimeDayId: runtimeDay?.runtimeDayId ?? null,
          });
          continue;
        }

        const scheduled = this.buildWorkingSchedule(workDate, shift, timezone);
        entries.push({
          employeeId: employee.id,
          workDate,
          dayType: ShiftRosterDayType.WORKING,
          dayPortion,
          shiftId: shift.id,
          scheduledStartAt: scheduled.scheduledStartAt,
          scheduledEndAt: scheduled.scheduledEndAt,
          breakMinutes: shift.breakMinutes,
          scheduledNetMinutes: scheduled.scheduledNetMinutes,
          timezone,
          generationKey,
          source: ShiftRosterEntrySource.GENERATED,
          action: existing ? 'update' : 'create',
          existingEntryId: existing?.id,
          businessCalendarRuntimeDayId: runtimeDay?.runtimeDayId ?? null,
        });
      }

      if (hasAnyEntry) {
        includedEmployees.push(employee.id);
      } else {
        excludedEmployees.push({
          employeeId: employee.id,
          reason: 'Outside joining/separation window for roster period',
        });
      }
    }

    const summary = {
      toCreate: entries.filter((entry) => entry.action === 'create').length,
      toUpdate: entries.filter((entry) => entry.action === 'update').length,
      toRetain: entries.filter((entry) => entry.action === 'retain').length,
      toSkip: entries.filter((entry) => entry.action === 'skip').length,
      toDelete: entries.filter((entry) => entry.action === 'delete').length,
    };

    return {
      branchId: input.branch.id,
      companyId: input.branch.companyId,
      periodStart,
      periodEnd,
      timezone,
      includedEmployees,
      excludedEmployees,
      warnings,
      entries,
      summary,
    };
  }

  private buildWorkingDayMap(
    workingDays: BranchContext['workingDays'],
  ): Map<number, BranchContext['workingDays'][number]> {
    if (workingDays.length === 0) {
      return new Map(
        [1, 2, 3, 4, 5].map((dayOfWeek) => [
          dayOfWeek,
          {
            dayOfWeek,
            isWorkingDay: true,
            dayPortion: DayPortion.FULL_DAY,
          },
        ]),
      );
    }

    return new Map(workingDays.map((day) => [day.dayOfWeek, day]));
  }

  private buildHolidayMap(holidays: Holiday[]): Map<string, Holiday> {
    const map = new Map<string, Holiday>();
    for (const holiday of holidays) {
      const key = parseCalendarDateInput(holiday.holidayDate);
      const existing = map.get(key);
      if (!existing || holiday.branchId) {
        map.set(key, holiday);
      }
    }
    return map;
  }

  private buildEmployeeShiftMap(
    assignments: EmployeeShiftAssignment[],
  ): Map<string, EmployeeShiftAssignment[]> {
    const map = new Map<string, EmployeeShiftAssignment[]>();
    for (const assignment of assignments) {
      const list = map.get(assignment.employeeId) ?? [];
      list.push(assignment);
      map.set(assignment.employeeId, list);
    }
    return map;
  }

  private resolveShiftForDate(
    assignments: EmployeeShiftAssignment[],
    workDate: string,
  ): Shift | null {
    const date = calendarDateToDbDate(workDate);
    const active = assignments
      .filter(
        (assignment) =>
          assignment.effectiveFrom <= date &&
          (assignment.effectiveTo == null || assignment.effectiveTo >= date),
      )
      .sort((a, b) => b.effectiveFrom.getTime() - a.effectiveFrom.getTime());

    return active[0]?.shift ?? null;
  }

  private buildWorkingSchedule(
    workDate: string,
    shift: Shift,
    timezone: string,
  ): {
    scheduledStartAt: Date;
    scheduledEndAt: Date;
    scheduledNetMinutes: number;
  } {
    const scheduledStartAt = calendarDateTimeToUtc(
      workDate,
      shift.startTime,
      timezone,
    );
    let scheduledEndAt = calendarDateTimeToUtc(
      workDate,
      shift.endTime,
      timezone,
    );
    if (shift.isNightShift || scheduledEndAt <= scheduledStartAt) {
      scheduledEndAt = new Date(scheduledEndAt.getTime() + 24 * 60 * 60 * 1000);
    }

    const grossMinutes = parseShiftDurationMinutes(
      shift.startTime,
      shift.endTime,
    );
    const scheduledNetMinutes = Math.max(0, grossMinutes - shift.breakMinutes);

    return { scheduledStartAt, scheduledEndAt, scheduledNetMinutes };
  }

  private buildNonWorkingEntry(input: {
    employeeId: string;
    workDate: string;
    rosterId: string;
    timezone: string;
    dayType: ShiftRosterDayType;
    dayPortion: DayPortion;
    existing?: ShiftRosterEntry;
  }): ShiftRosterGenerationEntry {
    const generationKey = this.buildGenerationKey(
      input.rosterId,
      input.employeeId,
      input.workDate,
    );

    return {
      employeeId: input.employeeId,
      workDate: input.workDate,
      dayType: input.dayType,
      dayPortion: input.dayPortion,
      shiftId: null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      breakMinutes: 0,
      scheduledNetMinutes: 0,
      timezone: input.timezone,
      generationKey,
      source: ShiftRosterEntrySource.GENERATED,
      action: input.existing ? 'update' : 'create',
      existingEntryId: input.existing?.id,
    };
  }
}
