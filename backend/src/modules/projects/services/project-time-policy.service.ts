import { Injectable } from '@nestjs/common';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { BranchTimeService } from '../../attendance/branch-time.service';
import { addOneCalendarDay } from '../../leave-policy/leave-calendar.util';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import {
  parseDateOnly,
  toDateOnlyIso,
  type ProjectWeekStartDay,
  weekEndingSunday,
  weekStartOf,
} from '../policies/work-log-week';

export const PROJECTS_WEEK_START_SETTING_KEY = 'projects.week_start';

const WEEK_START_BY_VALUE: Record<string, ProjectWeekStartDay> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

export function parseProjectsWeekStartSetting(
  value: string | null | undefined,
): ProjectWeekStartDay {
  if (value == null || value.trim() === '') {
    return WEEK_START_BY_VALUE.MONDAY;
  }

  const normalized = value.trim().toUpperCase();
  const weekStart = WEEK_START_BY_VALUE[normalized];
  if (weekStart === undefined) {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.TIMESHEET_STATE_CHANGED,
      `${PROJECTS_WEEK_START_SETTING_KEY} must be a weekday name.`,
    );
  }
  return weekStart;
}

@Injectable()
export class ProjectTimePolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchTime: BranchTimeService,
  ) {}

  async resolveTimesheetPeriod(input: {
    companyId: string;
    branchId: string;
    requestedPeriodStart: string;
  }): Promise<{
    periodStart: Date;
    periodEnd: Date;
    timezone: string;
    weekStartDay: ProjectWeekStartDay;
  }> {
    const [branch, setting] = await Promise.all([
      this.requireActiveBranch(input.companyId, input.branchId),
      this.prisma.companySetting.findUnique({
        where: {
          companyId_settingKey: {
            companyId: input.companyId,
            settingKey: PROJECTS_WEEK_START_SETTING_KEY,
          },
        },
        select: { settingValue: true },
      }),
    ]);
    const timezone = this.branchTime.requireTimezone(branch.timezone);
    const weekStartDay = parseProjectsWeekStartSetting(setting?.settingValue);
    const periodStart = weekStartOf(
      parseDateOnly(input.requestedPeriodStart),
      weekStartDay,
    );

    return {
      periodStart,
      periodEnd: weekEndingSunday(periodStart),
      timezone,
      weekStartDay,
    };
  }

  async businessDayWindow(input: {
    companyId: string;
    branchId: string;
    workDate: Date;
  }): Promise<{ start: Date; endExclusive: Date; timezone: string }> {
    const branch = await this.requireActiveBranch(
      input.companyId,
      input.branchId,
    );
    const timezone = this.branchTime.requireTimezone(branch.timezone);
    const calendarDate = toDateOnlyIso(input.workDate);

    return {
      start: this.branchTime.localDateTimeToUtc(
        calendarDate,
        '00:00',
        timezone,
      ),
      endExclusive: this.branchTime.localDateTimeToUtc(
        addOneCalendarDay(calendarDate),
        '00:00',
        timezone,
      ),
      timezone,
    };
  }

  businessDateAt(now: Date, timezone: string): Date {
    return parseDateOnly(this.branchTime.businessDate(now, timezone));
  }

  private async requireActiveBranch(companyId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
      select: { id: true, timezone: true },
    });
    if (!branch) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Active branch context is required for Project timesheets.',
      );
    }
    return branch;
  }
}
