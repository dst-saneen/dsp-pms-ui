import { DayPortion } from '@prisma/client';

import {
  adjustScheduledNetMinutes,
  calculateRosterAwareMetrics,
  calculateRosterLateMinutes,
  classifyDayByThreshold,
  defaultRosterAwarePolicy,
} from './attendance-roster-metrics.util';

describe('attendance-roster-metrics.util', () => {
  const start = new Date('2026-08-05T03:30:00.000Z'); // 09:00 IST
  const policy = defaultRosterAwarePolicy();

  it('treats exactly +30:00 as on time and +30:01 as late', () => {
    const onTime = calculateRosterLateMinutes({
      checkInTime: new Date(start.getTime() + 30 * 60 * 1000),
      scheduledStartAt: start,
      lateGraceMinutes: 30,
    });
    expect(onTime.isLate).toBe(false);
    expect(onTime.lateMinutes).toBe(0);

    const late = calculateRosterLateMinutes({
      checkInTime: new Date(start.getTime() + 30 * 60 * 1000 + 1000),
      scheduledStartAt: start,
      lateGraceMinutes: 30,
    });
    expect(late.isLate).toBe(true);
    expect(late.lateMinutes).toBeGreaterThanOrEqual(30);

    const late31 = calculateRosterLateMinutes({
      checkInTime: new Date(start.getTime() + 31 * 60 * 1000),
      scheduledStartAt: start,
      lateGraceMinutes: 30,
    });
    expect(late31.lateMinutes).toBe(31);
  });

  it('classifies full/half/absent at 90%/50% boundaries', () => {
    expect(
      classifyDayByThreshold({
        workedMinutes: 432,
        adjustedScheduledNetMinutes: 480,
        fullDayThresholdPercent: 90,
        halfDayThresholdPercent: 50,
      }).status,
    ).toBe('PRESENT');

    expect(
      classifyDayByThreshold({
        workedMinutes: 240,
        adjustedScheduledNetMinutes: 480,
        fullDayThresholdPercent: 90,
        halfDayThresholdPercent: 50,
      }).status,
    ).toBe('HALF_DAY');

    expect(
      classifyDayByThreshold({
        workedMinutes: 239,
        adjustedScheduledNetMinutes: 480,
        fullDayThresholdPercent: 90,
        halfDayThresholdPercent: 50,
      }).status,
    ).toBe('ABSENT');
  });

  it('halves scheduled minutes for first/second half portions', () => {
    expect(adjustScheduledNetMinutes(480, DayPortion.FIRST_HALF, 1)).toBe(240);
  });

  it('computes overnight roster-aware metrics without fabricating punches', () => {
    const scheduledStartAt = new Date('2026-08-05T16:30:00.000Z'); // 22:00 IST
    const scheduledEndAt = new Date('2026-08-06T02:30:00.000Z'); // 08:00 IST next day
    const checkInTime = new Date('2026-08-05T16:45:00.000Z');
    const checkOutTime = new Date('2026-08-06T02:30:00.000Z');

    const metrics = calculateRosterAwareMetrics({
      checkInTime,
      checkOutTime,
      schedule: {
        shiftRosterEntryId: 'entry-1',
        shiftId: 'shift-1',
        scheduledStartAt,
        scheduledEndAt,
        scheduledBreakMinutes: 30,
        scheduledNetMinutes: 540,
        scheduleTimezone: 'Asia/Kolkata',
        scheduleDayType: 'WORKING',
        schedulePortion: DayPortion.FULL_DAY,
      },
      policy,
    });

    expect(metrics.isLate).toBe(false);
    expect(metrics.status).toBe('PRESENT');
    expect(metrics.workedMinutes).toBeGreaterThan(0);
  });
});
