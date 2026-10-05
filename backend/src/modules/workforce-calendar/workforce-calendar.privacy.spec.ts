import { ShiftRosterDayType } from '@prisma/client';

import { calculatePrivacyState } from './workforce-calendar.privacy';

describe('calculatePrivacyState', () => {
  it('maps leave/holiday/week-off/attendance to privacy-safe states', () => {
    expect(
      calculatePrivacyState({
        rosterDayType: ShiftRosterDayType.WORKING,
        holiday: false,
        leaveStatus: 'APPROVED',
        attendanceStatus: null,
      }),
    ).toBe('ON_LEAVE');

    expect(
      calculatePrivacyState({
        rosterDayType: ShiftRosterDayType.WEEK_OFF,
        holiday: false,
        leaveStatus: null,
        attendanceStatus: null,
      }),
    ).toBe('WEEK_OFF');

    expect(
      calculatePrivacyState({
        rosterDayType: null,
        holiday: true,
        leaveStatus: null,
        attendanceStatus: null,
      }),
    ).toBe('HOLIDAY');

    expect(
      calculatePrivacyState({
        rosterDayType: ShiftRosterDayType.WORKING,
        holiday: false,
        leaveStatus: null,
        attendanceStatus: 'PRESENT',
      }),
    ).toBe('PRESENT');
  });
});
