import { OvertimeRoundingMode, ShiftRosterDayType } from '@prisma/client';

import type { ResolvedOvertimePolicy } from '../workforce-policy/overtime-policy-resolver.service';

export interface OvertimeAttendanceSnapshot {
  checkInTime: Date;
  checkOutTime: Date;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  scheduledBreakMinutes: number | null;
  scheduledNetMinutes: number | null;
  scheduleDayType: ShiftRosterDayType | null;
}

export interface OvertimeEligibilityResult {
  rawMinutes: number;
  eligibleMinutes: number;
  workedMinutes: number;
  scheduledNetMinutes: number | null;
  dayType: ShiftRosterDayType | null;
  isHolidayOrWeekOff: boolean;
  earlyArrivalExcludedMinutes: number;
  makeupExcluded: boolean;
  belowMinimum: boolean;
  calculationSnapshot: Record<string, unknown>;
}

export function roundEligibleMinutes(
  rawMinutes: number,
  roundingMinutes: number,
  roundingMode: OvertimeRoundingMode = OvertimeRoundingMode.DOWN,
): number {
  if (rawMinutes <= 0 || roundingMinutes <= 0) {
    return 0;
  }

  if (roundingMode === OvertimeRoundingMode.DOWN) {
    return Math.floor(rawMinutes / roundingMinutes) * roundingMinutes;
  }

  return Math.floor(rawMinutes / roundingMinutes) * roundingMinutes;
}

export function minutesToCompOffDays(
  approvedMinutes: number,
  halfDayMinutes: number,
  fullDayMinutes: number,
  maxDaysPerSource: number,
): number {
  if (approvedMinutes >= fullDayMinutes) {
    return Math.min(maxDaysPerSource, 1);
  }
  if (approvedMinutes >= halfDayMinutes) {
    return Math.min(maxDaysPerSource, 0.5);
  }
  return 0;
}

/**
 * Plan §9.1:
 * - Early arrival excluded (unless policy allows).
 * - Late makeup is not OT: only excess over scheduled net counts on normal days.
 * - Holiday / week-off: all net worked minutes are raw OT candidates.
 * - Round down to completed rounding units; below minimum => 0 eligible.
 */
export function calculateOvertimeEligibility(params: {
  attendance: OvertimeAttendanceSnapshot;
  policy: Pick<
    ResolvedOvertimePolicy,
    | 'minimumEligibleMinutes'
    | 'roundingMinutes'
    | 'roundingMode'
    | 'includeEarlyArrival'
    | 'requireScheduledMinutesFulfilled'
    | 'maxDailyMinutes'
    | 'policyId'
    | 'source'
  >;
}): OvertimeEligibilityResult {
  const { attendance, policy } = params;
  const breakMinutes = Math.max(0, attendance.scheduledBreakMinutes ?? 0);
  const dayType = attendance.scheduleDayType;
  const isHolidayOrWeekOff =
    dayType === ShiftRosterDayType.HOLIDAY ||
    dayType === ShiftRosterDayType.WEEK_OFF;

  const scheduledStart = attendance.scheduledStartAt;
  let earlyArrivalExcludedMinutes = 0;
  let effectiveStart = attendance.checkInTime;

  if (
    !policy.includeEarlyArrival &&
    scheduledStart &&
    attendance.checkInTime < scheduledStart
  ) {
    earlyArrivalExcludedMinutes = Math.max(
      0,
      Math.floor(
        (scheduledStart.getTime() - attendance.checkInTime.getTime()) /
          (1000 * 60),
      ),
    );
    effectiveStart = scheduledStart;
  }

  const grossMinutes = Math.max(
    0,
    Math.floor(
      (attendance.checkOutTime.getTime() - effectiveStart.getTime()) /
        (1000 * 60),
    ),
  );
  const workedMinutes = Math.max(0, grossMinutes - breakMinutes);
  const scheduledNet =
    attendance.scheduledNetMinutes != null && attendance.scheduledNetMinutes > 0
      ? attendance.scheduledNetMinutes
      : null;

  let rawMinutes = 0;
  let makeupExcluded = false;

  if (isHolidayOrWeekOff) {
    rawMinutes = workedMinutes;
  } else if (policy.requireScheduledMinutesFulfilled && scheduledNet != null) {
    rawMinutes = Math.max(0, workedMinutes - scheduledNet);
    makeupExcluded = true;
  } else if (attendance.scheduledEndAt) {
    rawMinutes = Math.max(
      0,
      Math.floor(
        (attendance.checkOutTime.getTime() -
          attendance.scheduledEndAt.getTime()) /
          (1000 * 60),
      ),
    );
  } else {
    rawMinutes = workedMinutes;
  }

  if (policy.maxDailyMinutes != null) {
    rawMinutes = Math.min(rawMinutes, policy.maxDailyMinutes);
  }

  let eligibleMinutes = roundEligibleMinutes(
    rawMinutes,
    policy.roundingMinutes,
    policy.roundingMode,
  );
  const belowMinimum = eligibleMinutes < policy.minimumEligibleMinutes;
  if (belowMinimum) {
    eligibleMinutes = 0;
  }

  return {
    rawMinutes,
    eligibleMinutes,
    workedMinutes,
    scheduledNetMinutes: scheduledNet,
    dayType,
    isHolidayOrWeekOff,
    earlyArrivalExcludedMinutes,
    makeupExcluded,
    belowMinimum,
    calculationSnapshot: {
      policyId: policy.policyId,
      policySource: policy.source,
      minimumEligibleMinutes: policy.minimumEligibleMinutes,
      roundingMinutes: policy.roundingMinutes,
      roundingMode: policy.roundingMode,
      includeEarlyArrival: policy.includeEarlyArrival,
      requireScheduledMinutesFulfilled: policy.requireScheduledMinutesFulfilled,
      maxDailyMinutes: policy.maxDailyMinutes,
      checkInTime: attendance.checkInTime.toISOString(),
      checkOutTime: attendance.checkOutTime.toISOString(),
      scheduledStartAt: attendance.scheduledStartAt?.toISOString() ?? null,
      scheduledEndAt: attendance.scheduledEndAt?.toISOString() ?? null,
      scheduledBreakMinutes: breakMinutes,
      scheduledNetMinutes: scheduledNet,
      scheduleDayType: dayType,
      workedMinutes,
      rawMinutes,
      eligibleMinutes,
      earlyArrivalExcludedMinutes,
      makeupExcluded,
      belowMinimum,
    },
  };
}
