import { BadRequestException, Injectable } from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
  BusinessDayStatus,
  DayPortion,
  Prisma,
  ShiftRosterDayType,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { BusinessCalendarRuntimeService } from './business-calendar-runtime.service';
import { eachDateInclusive } from './business-calendar-runtime.util';
import { isValidIanaTimeZone } from './business-calendar-validators';

export type ConsumerDayKind = 'WORKING' | 'HOLIDAY' | 'WEEK_OFF' | 'HALF_DAY';

export type ConsumerDayResolution = {
  date: string;
  dayStatus: BusinessDayStatus;
  dayPortion: DayPortion;
  kind: ConsumerDayKind;
  reasonCode: string;
  reasonText: string;
  runtimeDayId: string | null;
  controllingEventId: string | null;
};

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BusinessCalendarConsumerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: BusinessCalendarRuntimeService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  /**
   * Office-level switch: branch calendar mode wins when a branch calendar exists.
   */
  async resolveOfficeRuntimeMode(
    companyId: string,
    branchId: string,
    db: DbClient = this.prisma,
  ): Promise<{
    mode: BusinessCalendarRuntimeMode;
    calendarId: string | null;
  }> {
    const branchCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId,
        branchId,
        scope: BusinessCalendarScope.BRANCH,
        isActive: true,
      },
      select: { id: true, runtimeMode: true },
    });
    if (branchCalendar) {
      return {
        mode: branchCalendar.runtimeMode,
        calendarId: branchCalendar.id,
      };
    }

    const companyCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
      select: { id: true, runtimeMode: true },
    });
    if (companyCalendar) {
      return {
        mode: companyCalendar.runtimeMode,
        calendarId: companyCalendar.id,
      };
    }

    return { mode: BusinessCalendarRuntimeMode.LEGACY, calendarId: null };
  }

  async isActiveOffice(
    companyId: string,
    branchId: string,
    client?: Prisma.TransactionClient,
  ): Promise<boolean> {
    const db = client ?? this.prisma;
    const { mode } = await this.resolveOfficeRuntimeMode(
      companyId,
      branchId,
      db,
    );
    return mode === BusinessCalendarRuntimeMode.ACTIVE;
  }

  /**
   * Resolve a date range for ACTIVE offices. Materializes missing days on demand.
   */
  async resolveConsumerDays(input: {
    companyId: string;
    branchId: string;
    from: string;
    to: string;
    materialize?: boolean;
    client?: Prisma.TransactionClient;
  }): Promise<Map<string, ConsumerDayResolution>> {
    const db = input.client ?? this.prisma;
    const fromDate = this.parseDate(input.from);
    const toDate = this.parseDate(input.to);
    if (toDate < fromDate) {
      throw new BadRequestException('to cannot precede from');
    }

    const shouldMaterialize = input.materialize !== false && !input.client;
    if (shouldMaterialize) {
      try {
        await this.runtime.rebuild({
          companyId: input.companyId,
          branchId: input.branchId,
          from: input.from,
          to: input.to,
        });
      } catch {
        // Preview path still works for drafts / incomplete materialization.
      }
    }

    const office = await this.resolveOfficeCalendar(
      input.companyId,
      input.branchId,
      db,
    );
    const rows = await db.businessCalendarRuntimeDay.findMany({
      where: {
        officeScopeKey: office.scopeKey,
        businessDate: { gte: fromDate, lte: toDate },
        isCurrent: true,
      },
    });
    const byDate = new Map(
      rows.map((row) => [row.businessDate.toISOString().slice(0, 10), row]),
    );

    const result = new Map<string, ConsumerDayResolution>();
    const missingKeys: string[] = [];
    for (const date of eachDateInclusive(fromDate, toDate)) {
      const key = date.toISOString().slice(0, 10);
      const row = byDate.get(key);
      if (row) {
        result.set(key, this.mapRow(row));
      } else {
        missingKeys.push(key);
      }
    }

    if (missingKeys.length > 0) {
      const previews = await this.runtime.previewRange(
        {
          companyId: input.companyId,
          branchId: input.branchId,
          from: missingKeys[0],
          to: missingKeys[missingKeys.length - 1],
        },
        db,
      );
      const previewByDate = new Map(
        previews.map((preview) => [preview.businessDate, preview]),
      );
      for (const key of missingKeys) {
        const preview = previewByDate.get(key);
        if (!preview) {
          throw new BadRequestException(
            `Business calendar preview missing for ${key}`,
          );
        }
        result.set(key, this.mapPreview(key, preview));
      }
    }

    return result;
  }

  mapRosterDayType(day: ConsumerDayResolution): {
    dayType: ShiftRosterDayType;
    dayPortion: DayPortion;
  } {
    if (day.kind === 'HOLIDAY') {
      return {
        dayType:
          day.dayPortion === DayPortion.FULL_DAY
            ? ShiftRosterDayType.HOLIDAY
            : ShiftRosterDayType.SCHEDULED_HALF_DAY,
        dayPortion: day.dayPortion,
      };
    }
    if (day.kind === 'WEEK_OFF') {
      return {
        dayType: ShiftRosterDayType.WEEK_OFF,
        dayPortion: day.dayPortion,
      };
    }
    if (day.kind === 'HALF_DAY') {
      return {
        dayType: ShiftRosterDayType.SCHEDULED_HALF_DAY,
        dayPortion: day.dayPortion,
      };
    }
    return {
      dayType: ShiftRosterDayType.WORKING,
      dayPortion: day.dayPortion,
    };
  }

  /**
   * Leave charge helper for ACTIVE mode.
   */
  summarizeLeaveDays(
    days: Map<string, ConsumerDayResolution>,
    isHalfDay: boolean,
  ): {
    requestedWorkingDays: number;
    excludedHolidays: string[];
    excludedNonWorkingDays: string[];
    snapshots: Array<{
      businessDate: string;
      runtimeDayId: string | null;
      dayPortion: DayPortion;
      chargedDays: number;
      calculationStatus: string;
    }>;
  } {
    const excludedHolidays: string[] = [];
    const excludedNonWorkingDays: string[] = [];
    const snapshots: Array<{
      businessDate: string;
      runtimeDayId: string | null;
      dayPortion: DayPortion;
      chargedDays: number;
      calculationStatus: string;
    }> = [];
    let workingDayCount = 0;
    let charged = 0;

    for (const [date, day] of [...days.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      if (day.kind === 'HOLIDAY') {
        excludedHolidays.push(date);
        snapshots.push({
          businessDate: date,
          runtimeDayId: day.runtimeDayId,
          dayPortion: day.dayPortion,
          chargedDays: 0,
          calculationStatus: 'EXCLUDED_HOLIDAY',
        });
        continue;
      }
      if (day.kind === 'WEEK_OFF') {
        excludedNonWorkingDays.push(date);
        snapshots.push({
          businessDate: date,
          runtimeDayId: day.runtimeDayId,
          dayPortion: day.dayPortion,
          chargedDays: 0,
          calculationStatus: 'EXCLUDED_NON_WORKING',
        });
        continue;
      }

      workingDayCount += 1;
      const dayCharge =
        day.kind === 'HALF_DAY' || day.dayPortion !== DayPortion.FULL_DAY
          ? 0.5
          : 1;
      charged += dayCharge;
      snapshots.push({
        businessDate: date,
        runtimeDayId: day.runtimeDayId,
        dayPortion: day.dayPortion,
        chargedDays: dayCharge,
        calculationStatus: 'CHARGED',
      });
    }

    if (isHalfDay) {
      if (workingDayCount !== 1) {
        throw new BadRequestException({
          code: 'BAD_REQUEST',
          message:
            'Half-day leave must fall on a single working day that is not a holiday',
        });
      }
      return {
        requestedWorkingDays: 0.5,
        excludedHolidays,
        excludedNonWorkingDays,
        snapshots: snapshots.map((row) =>
          row.calculationStatus === 'CHARGED'
            ? { ...row, chargedDays: 0.5 }
            : row,
        ),
      };
    }

    return {
      requestedWorkingDays: charged,
      excludedHolidays,
      excludedNonWorkingDays,
      snapshots,
    };
  }

  async setOfficeRuntimeMode(input: {
    companyId: string;
    branchId?: string;
    mode: BusinessCalendarRuntimeMode;
    actorUserId: string;
  }) {
    await this.employeeDomainScope.assertCompanyInScope(input.companyId);

    const where: Prisma.BusinessCalendarWhereInput = {
      companyId: input.companyId,
      isActive: true,
    };
    if (input.branchId) {
      where.branchId = input.branchId;
      where.scope = BusinessCalendarScope.BRANCH;
    } else {
      where.scope = BusinessCalendarScope.COMPANY;
      where.branchId = null;
    }

    const calendar = await this.prisma.businessCalendar.findFirst({ where });
    if (!calendar) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'Business calendar not found for office',
      });
    }

    const publishedVersion =
      await this.prisma.businessCalendarVersion.findFirst({
        where: {
          calendarId: calendar.id,
          status: BusinessCalendarVersionStatus.PUBLISHED,
        },
        select: { id: true },
      });
    if (!publishedVersion) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message: 'Publish a calendar version before testing or activating it.',
      });
    }

    if (
      input.mode === BusinessCalendarRuntimeMode.ACTIVE &&
      calendar.runtimeMode === BusinessCalendarRuntimeMode.LEGACY
    ) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_VERSION_NOT_EDITABLE,
        message:
          'Complete the reviewed calendar comparison before activating this calendar.',
      });
    }

    return this.prisma.businessCalendar.update({
      where: { id: calendar.id },
      data: {
        runtimeMode: input.mode,
        updatedByUserId: input.actorUserId,
      },
    });
  }

  private async resolveOfficeCalendar(
    companyId: string,
    branchId: string,
    db: DbClient = this.prisma,
  ) {
    const branchCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId,
        branchId,
        scope: BusinessCalendarScope.BRANCH,
        isActive: true,
      },
    });
    if (branchCalendar) {
      return branchCalendar;
    }
    const companyCalendar = await db.businessCalendar.findFirst({
      where: {
        companyId,
        scope: BusinessCalendarScope.COMPANY,
        isActive: true,
      },
    });
    if (!companyCalendar) {
      throw new BadRequestException({
        code: BusinessCalendarErrorCode.CALENDAR_NOT_FOUND,
        message: 'No business calendar configured for office',
      });
    }
    return companyCalendar;
  }

  private mapRow(row: {
    id: string;
    businessDate: Date;
    dayStatus: BusinessDayStatus;
    dayPortion: DayPortion;
    reasonCode: string;
    reasonText: string;
    controllingEventId: string | null;
  }): ConsumerDayResolution {
    return {
      date: row.businessDate.toISOString().slice(0, 10),
      dayStatus: row.dayStatus,
      dayPortion: row.dayPortion,
      kind: this.classify(row.dayStatus, row.dayPortion, row.reasonCode),
      reasonCode: row.reasonCode,
      reasonText: row.reasonText,
      runtimeDayId: row.id,
      controllingEventId: row.controllingEventId,
    };
  }

  private mapPreview(
    date: string,
    preview: {
      result: {
        dayStatus: BusinessDayStatus;
        dayPortion: DayPortion;
        reasonCode: string;
        reasonText: string;
        controllingEventId: string | null;
      };
    },
  ): ConsumerDayResolution {
    const result = preview.result;
    return {
      date,
      dayStatus: result.dayStatus,
      dayPortion: result.dayPortion,
      kind: this.classify(
        result.dayStatus,
        result.dayPortion,
        result.reasonCode,
      ),
      reasonCode: result.reasonCode,
      reasonText: result.reasonText,
      runtimeDayId: null,
      controllingEventId: result.controllingEventId,
    };
  }

  private classify(
    dayStatus: BusinessDayStatus,
    dayPortion: DayPortion,
    reasonCode: string,
  ): ConsumerDayKind {
    if (dayStatus === BusinessDayStatus.NON_WORKING) {
      return reasonCode === 'EVENT' || reasonCode === 'LEGACY_HOLIDAY'
        ? 'HOLIDAY'
        : 'WEEK_OFF';
    }
    if (
      dayPortion === DayPortion.FIRST_HALF ||
      dayPortion === DayPortion.SECOND_HALF
    ) {
      return reasonCode === 'EVENT' ? 'HOLIDAY' : 'HALF_DAY';
    }
    return 'WORKING';
  }

  private parseDate(value: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value.slice(0, 10))) {
      throw new BadRequestException('Dates must be YYYY-MM-DD');
    }
    return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  }
}

export function assertTimezone(timezone: string | null | undefined): string {
  const value = timezone?.trim() ?? '';
  if (!value || !isValidIanaTimeZone(value)) {
    throw new BadRequestException('Valid IANA timezone required');
  }
  return value;
}
