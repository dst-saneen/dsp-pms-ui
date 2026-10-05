import { DayPortion, ShiftRosterDayType } from '@prisma/client';

import { WorkforcePolicyDefaults } from '../../common/constants/workforce-time-contracts';

export interface RosterScheduleSnapshot {
  shiftRosterEntryId: string | null;
  shiftId: string | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  scheduledBreakMinutes: number | null;
  scheduledNetMinutes: number | null;
  scheduleTimezone: string | null;
  scheduleDayType: ShiftRosterDayType | null;
  schedulePortion: DayPortion | null;
  businessCalendarRuntimeDayId?: string | null;
}

export interface RosterAwarePolicy {
  lateGraceMinutes: number;
  earlyDepartureGraceMinutes: number;
  fullDayThresholdPercent: number;
  halfDayThresholdPercent: number;
  maxOpenShiftMinutes: number;
}

export interface RosterAwareMetrics {
  workedMinutes: number;
  workedHours: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
  classificationReason: string;
  isLate: boolean;
  isEarlyDeparture: boolean;
  isInsufficientHours: boolean;
}

/** Plan §6.2: exactly +grace is On Time; later is Late. lateMinutes = full delta from start. */
export function calculateRosterLateMinutes(params: {
  checkInTime: Date;
  scheduledStartAt: Date | null;
  lateGraceMinutes: number;
}): { isLate: boolean; lateMinutes: number } {
  if (!params.scheduledStartAt) {
    return { isLate: false, lateMinutes: 0 };
  }

  const graceEnd = new Date(
    params.scheduledStartAt.getTime() + params.lateGraceMinutes * 60 * 1000,
  );

  if (params.checkInTime <= graceEnd) {
    return { isLate: false, lateMinutes: 0 };
  }

  return {
    isLate: true,
    lateMinutes: Math.max(
      0,
      Math.floor(
        (params.checkInTime.getTime() - params.scheduledStartAt.getTime()) /
          (1000 * 60),
      ),
    ),
  };
}

export function calculateRosterEarlyDepartureMinutes(params: {
  checkOutTime: Date;
  scheduledEndAt: Date | null;
  earlyDepartureGraceMinutes: number;
}): { isEarly: boolean; earlyDepartureMinutes: number } {
  if (!params.scheduledEndAt) {
    return { isEarly: false, earlyDepartureMinutes: 0 };
  }

  const earlyThreshold = new Date(
    params.scheduledEndAt.getTime() -
      params.earlyDepartureGraceMinutes * 60 * 1000,
  );

  if (params.checkOutTime >= earlyThreshold) {
    return { isEarly: false, earlyDepartureMinutes: 0 };
  }

  return {
    isEarly: true,
    earlyDepartureMinutes: Math.max(
      0,
      Math.floor(
        (params.scheduledEndAt.getTime() - params.checkOutTime.getTime()) /
          (1000 * 60),
      ),
    ),
  };
}

/**
 * Adjust scheduled net minutes for half-day portion / half-day leave factor.
 * leaveAdjustmentFactor: 1 = full expected, 0.5 = half day leave approved.
 */
export function adjustScheduledNetMinutes(
  scheduledNetMinutes: number | null | undefined,
  schedulePortion: DayPortion | null | undefined,
  leaveAdjustmentFactor = 1,
): number | null {
  if (scheduledNetMinutes == null || scheduledNetMinutes <= 0) {
    return null;
  }

  let adjusted = scheduledNetMinutes;
  if (
    schedulePortion === DayPortion.FIRST_HALF ||
    schedulePortion === DayPortion.SECOND_HALF
  ) {
    adjusted = Math.floor(adjusted / 2);
  }

  return Math.max(0, Math.floor(adjusted * leaveAdjustmentFactor));
}

export function classifyDayByThreshold(params: {
  workedMinutes: number;
  adjustedScheduledNetMinutes: number | null;
  fullDayThresholdPercent: number;
  halfDayThresholdPercent: number;
}): {
  status: 'PRESENT' | 'HALF_DAY' | 'ABSENT';
  classificationReason: string;
  isInsufficientHours: boolean;
} {
  if (
    params.adjustedScheduledNetMinutes == null ||
    params.adjustedScheduledNetMinutes <= 0
  ) {
    // Unscheduled work: keep PRESENT if any worked time, else ABSENT.
    if (params.workedMinutes > 0) {
      return {
        status: 'PRESENT',
        classificationReason: 'UNSCHEDULED_WORKED',
        isInsufficientHours: false,
      };
    }
    return {
      status: 'ABSENT',
      classificationReason: 'NO_SCHEDULE_NO_WORK',
      isInsufficientHours: false,
    };
  }

  const percent =
    (params.workedMinutes / params.adjustedScheduledNetMinutes) * 100;

  if (percent >= params.fullDayThresholdPercent) {
    return {
      status: 'PRESENT',
      classificationReason: `FULL_DAY_${Math.floor(percent)}`,
      isInsufficientHours: false,
    };
  }

  if (percent >= params.halfDayThresholdPercent) {
    return {
      status: 'HALF_DAY',
      classificationReason: `HALF_DAY_${Math.floor(percent)}`,
      isInsufficientHours: true,
    };
  }

  return {
    status: 'ABSENT',
    classificationReason: `ABSENT_${Math.floor(percent)}`,
    isInsufficientHours: true,
  };
}

export function calculateRosterAwareMetrics(params: {
  checkInTime: Date;
  checkOutTime: Date;
  schedule: RosterScheduleSnapshot;
  policy: RosterAwarePolicy;
  leaveAdjustmentFactor?: number;
}): RosterAwareMetrics {
  const grossMinutes = Math.max(
    0,
    Math.floor(
      (params.checkOutTime.getTime() - params.checkInTime.getTime()) /
        (1000 * 60),
    ),
  );

  const breakMinutes = params.schedule.scheduledBreakMinutes ?? 0;
  const workedMinutes = Math.max(0, grossMinutes - breakMinutes);
  const workedHours = Number((workedMinutes / 60).toFixed(2));

  const late = calculateRosterLateMinutes({
    checkInTime: params.checkInTime,
    scheduledStartAt: params.schedule.scheduledStartAt,
    lateGraceMinutes: params.policy.lateGraceMinutes,
  });

  const early = calculateRosterEarlyDepartureMinutes({
    checkOutTime: params.checkOutTime,
    scheduledEndAt: params.schedule.scheduledEndAt,
    earlyDepartureGraceMinutes: params.policy.earlyDepartureGraceMinutes,
  });

  let overtimeMinutes = 0;
  if (
    params.schedule.scheduledEndAt &&
    params.checkOutTime > params.schedule.scheduledEndAt
  ) {
    // Early arrival is not OT; only time after scheduled end.
    overtimeMinutes = Math.max(
      0,
      Math.floor(
        (params.checkOutTime.getTime() -
          params.schedule.scheduledEndAt.getTime()) /
          (1000 * 60),
      ),
    );
  }

  const adjusted = adjustScheduledNetMinutes(
    params.schedule.scheduledNetMinutes,
    params.schedule.schedulePortion,
    params.leaveAdjustmentFactor ?? 1,
  );

  const classification = classifyDayByThreshold({
    workedMinutes,
    adjustedScheduledNetMinutes: adjusted,
    fullDayThresholdPercent: params.policy.fullDayThresholdPercent,
    halfDayThresholdPercent: params.policy.halfDayThresholdPercent,
  });

  return {
    workedMinutes,
    workedHours,
    lateMinutes: late.lateMinutes,
    earlyDepartureMinutes: early.earlyDepartureMinutes,
    overtimeMinutes,
    status: classification.status,
    classificationReason: classification.classificationReason,
    isLate: late.isLate,
    isEarlyDeparture: early.isEarly,
    isInsufficientHours: classification.isInsufficientHours,
  };
}

export function defaultRosterAwarePolicy(): RosterAwarePolicy {
  return {
    lateGraceMinutes: WorkforcePolicyDefaults.lateGraceMinutes,
    earlyDepartureGraceMinutes:
      WorkforcePolicyDefaults.earlyDepartureGraceMinutes,
    fullDayThresholdPercent: WorkforcePolicyDefaults.fullDayThresholdPercent,
    halfDayThresholdPercent: WorkforcePolicyDefaults.halfDayThresholdPercent,
    maxOpenShiftMinutes: WorkforcePolicyDefaults.maxOpenShiftMinutes,
  };
}

export function buildExceptionDedupeKey(
  employeeId: string,
  businessDate: string,
  type: string,
): string {
  return `${employeeId}:${businessDate}:${type}`;
}
