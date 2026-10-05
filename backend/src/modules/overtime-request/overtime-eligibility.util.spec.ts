import { OvertimeRoundingMode, ShiftRosterDayType } from '@prisma/client';

import {
  calculateOvertimeEligibility,
  minutesToCompOffDays,
  roundEligibleMinutes,
} from './overtime-eligibility.util';

describe('roundEligibleMinutes', () => {
  it.each([
    [29, 15],
    [30, 30],
    [44, 30],
    [45, 45],
  ])('maps %i raw minutes to %i after rounding', (raw, expected) => {
    expect(roundEligibleMinutes(raw, 15, OvertimeRoundingMode.DOWN)).toBe(
      expected,
    );
  });
});

describe('minutesToCompOffDays', () => {
  it('converts 240 to 0.5 and 480 to 1.0', () => {
    expect(minutesToCompOffDays(240, 240, 480, 1)).toBe(0.5);
    expect(minutesToCompOffDays(480, 240, 480, 1)).toBe(1);
    expect(minutesToCompOffDays(239, 240, 480, 1)).toBe(0);
  });
});

describe('calculateOvertimeEligibility', () => {
  const policy = {
    policyId: 'pol-1',
    source: 'SYSTEM_DEFAULT' as const,
    minimumEligibleMinutes: 30,
    roundingMinutes: 15,
    roundingMode: OvertimeRoundingMode.DOWN,
    includeEarlyArrival: false,
    requireScheduledMinutesFulfilled: true,
    maxDailyMinutes: null,
  };

  it('excludes early arrival and late makeup on a normal day', () => {
    // Scheduled 09:00-18:00 (540 gross, 60 break => 480 net)
    // Arrives 10:00 (60 late), leaves 19:00 — makeup after end, not OT
    const result = calculateOvertimeEligibility({
      attendance: {
        checkInTime: new Date('2026-08-03T10:00:00.000Z'),
        checkOutTime: new Date('2026-08-03T19:00:00.000Z'),
        scheduledStartAt: new Date('2026-08-03T09:00:00.000Z'),
        scheduledEndAt: new Date('2026-08-03T18:00:00.000Z'),
        scheduledBreakMinutes: 60,
        scheduledNetMinutes: 480,
        scheduleDayType: ShiftRosterDayType.WORKING,
      },
      policy,
    });

    expect(result.workedMinutes).toBe(480);
    expect(result.rawMinutes).toBe(0);
    expect(result.eligibleMinutes).toBe(0);
    expect(result.makeupExcluded).toBe(true);
  });

  it('counts excess over scheduled net as OT on a normal day', () => {
    const result = calculateOvertimeEligibility({
      attendance: {
        checkInTime: new Date('2026-08-03T09:00:00.000Z'),
        checkOutTime: new Date('2026-08-03T19:00:00.000Z'),
        scheduledStartAt: new Date('2026-08-03T09:00:00.000Z'),
        scheduledEndAt: new Date('2026-08-03T18:00:00.000Z'),
        scheduledBreakMinutes: 60,
        scheduledNetMinutes: 480,
        scheduleDayType: ShiftRosterDayType.WORKING,
      },
      policy,
    });

    // 10h gross - 60 break = 540 worked; 540 - 480 scheduled = 60 raw -> 60 eligible
    expect(result.rawMinutes).toBe(60);
    expect(result.eligibleMinutes).toBe(60);
  });

  it('treats all holiday net work as OT candidates', () => {
    const result = calculateOvertimeEligibility({
      attendance: {
        checkInTime: new Date('2026-08-03T09:00:00.000Z'),
        checkOutTime: new Date('2026-08-03T13:00:00.000Z'),
        scheduledStartAt: null,
        scheduledEndAt: null,
        scheduledBreakMinutes: 0,
        scheduledNetMinutes: null,
        scheduleDayType: ShiftRosterDayType.HOLIDAY,
      },
      policy,
    });

    expect(result.isHolidayOrWeekOff).toBe(true);
    expect(result.rawMinutes).toBe(240);
    expect(result.eligibleMinutes).toBe(240);
  });

  it('zeros eligible when below minimum after rounding', () => {
    const result = calculateOvertimeEligibility({
      attendance: {
        checkInTime: new Date('2026-08-03T09:00:00.000Z'),
        checkOutTime: new Date('2026-08-03T18:29:00.000Z'),
        scheduledStartAt: new Date('2026-08-03T09:00:00.000Z'),
        scheduledEndAt: new Date('2026-08-03T18:00:00.000Z'),
        scheduledBreakMinutes: 60,
        scheduledNetMinutes: 480,
        scheduleDayType: ShiftRosterDayType.WORKING,
      },
      policy,
    });

    // 569 gross - 60 = 509 worked; 509 - 480 = 29 raw -> rounds to 15? floor(29/15)*15=15, then < 30 => 0
    // Wait: 18:29 - 09:00 = 9h29m = 569 minutes. 569-60=509. 509-480=29.
    // round down 29/15 = 1 * 15 = 15, below minimum 30 => 0
    expect(result.rawMinutes).toBe(29);
    expect(result.eligibleMinutes).toBe(0);
    expect(result.belowMinimum).toBe(true);
  });
});
