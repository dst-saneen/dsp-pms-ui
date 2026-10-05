import {
  DEFAULT_WORKING_DAYS_OF_WEEK,
  addOneCalendarDay,
  dayOfWeekForCalendarDate,
  enumerateCalendarDates,
  isValidIanaTimeZone,
  toCalendarDate,
} from './leave-calendar.util';

describe('leave-calendar.util', () => {
  it('validates IANA timezones', () => {
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidIanaTimeZone('Not/AZone')).toBe(false);
  });

  it('enumerates inclusive calendar dates', () => {
    expect(enumerateCalendarDates('2026-08-03', '2026-08-05')).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
    ]);
  });

  it('uses Monday–Friday as default working days', () => {
    expect(DEFAULT_WORKING_DAYS_OF_WEEK).toEqual([1, 2, 3, 4, 5]);
    expect(dayOfWeekForCalendarDate('2026-08-03')).toBe(1); // Monday
    expect(dayOfWeekForCalendarDate('2026-08-08')).toBe(6); // Saturday
  });

  it('formats dates in the branch timezone', () => {
    const utcEvening = new Date('2026-08-03T20:00:00.000Z');
    expect(toCalendarDate(utcEvening, 'Asia/Kolkata')).toBe('2026-08-04');
    expect(addOneCalendarDay('2026-08-31')).toBe('2026-09-01');
  });
});
