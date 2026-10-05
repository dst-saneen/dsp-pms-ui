import { BadRequestException } from '@nestjs/common';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';

import {
  assertRosterPeriodRange,
  calendarRangesOverlap,
  inclusivePeriodDayCount,
  ROSTER_MAX_PERIOD_DAYS,
} from './shift-roster-period.util';

describe('shift-roster-period.util', () => {
  it('accepts a 62-day inclusive period', () => {
    expect(() =>
      assertRosterPeriodRange('2026-01-01', '2026-03-03'),
    ).not.toThrow();
    expect(inclusivePeriodDayCount('2026-01-01', '2026-03-03')).toBe(62);
  });

  it('rejects a 63-day period', () => {
    try {
      assertRosterPeriodRange('2026-01-01', '2026-03-04');
      fail('expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: WorkforceTimeErrorCode.ROSTER_PERIOD_TOO_LONG,
      });
    }
  });

  it('detects overlapping calendar ranges', () => {
    expect(
      calendarRangesOverlap(
        '2026-01-01',
        '2026-01-31',
        '2026-01-15',
        '2026-02-15',
      ),
    ).toBe(true);
    expect(
      calendarRangesOverlap(
        '2026-01-01',
        '2026-01-10',
        '2026-01-11',
        '2026-01-20',
      ),
    ).toBe(false);
  });

  it('uses locked max period constant', () => {
    expect(ROSTER_MAX_PERIOD_DAYS).toBe(62);
  });
});
