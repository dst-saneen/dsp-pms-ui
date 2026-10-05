import {
  calendarDateTimeToUtc,
  calculateAttendanceMetrics,
  calculateLateMinutes,
  calendarDateToUtcMidnight,
  isValidIanaTimeZone,
  parseShiftDurationMinutes,
  toCalendarDate,
} from './attendance-calendar.util';

describe('attendance-calendar.util', () => {
  it('validates IANA timezones', () => {
    expect(isValidIanaTimeZone('Asia/Kolkata')).toBe(true);
    expect(isValidIanaTimeZone('Invalid/Zone')).toBe(false);
  });

  it('stores business dates as UTC midnight keys', () => {
    expect(calendarDateToUtcMidnight('2026-08-03').toISOString()).toBe(
      '2026-08-03T00:00:00.000Z',
    );
  });

  it('calculates overnight shift duration', () => {
    expect(parseShiftDurationMinutes('22:00', '06:00')).toBe(8 * 60);
    expect(parseShiftDurationMinutes('09:00', '18:00')).toBe(9 * 60);
  });

  it('computes late minutes after grace', () => {
    const checkIn = calendarDateTimeToUtc(
      '2026-08-03',
      '09:20',
      'Asia/Kolkata',
    );
    const late = calculateLateMinutes({
      checkInTime: checkIn,
      attendanceCalendarDate: '2026-08-03',
      timeZone: 'Asia/Kolkata',
      shift: { startTime: '09:00', graceInMinutes: 15 },
    });
    expect(late).toBe(20);
  });

  it('deducts break only when gross duration meets threshold', () => {
    const checkIn = calendarDateTimeToUtc(
      '2026-08-03',
      '09:00',
      'Asia/Kolkata',
    );
    const fullDayOut = calendarDateTimeToUtc(
      '2026-08-03',
      '18:00',
      'Asia/Kolkata',
    );
    const shortOut = calendarDateTimeToUtc(
      '2026-08-03',
      '12:00',
      'Asia/Kolkata',
    );

    const full = calculateAttendanceMetrics({
      checkInTime: checkIn,
      checkOutTime: fullDayOut,
      attendanceCalendarDate: '2026-08-03',
      timeZone: 'Asia/Kolkata',
      shift: {
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        graceInMinutes: 15,
        graceOutMinutes: 15,
        isNightShift: false,
      },
    });

    const short = calculateAttendanceMetrics({
      checkInTime: checkIn,
      checkOutTime: shortOut,
      attendanceCalendarDate: '2026-08-03',
      timeZone: 'Asia/Kolkata',
      shift: {
        startTime: '09:00',
        endTime: '18:00',
        breakMinutes: 60,
        graceInMinutes: 15,
        graceOutMinutes: 15,
        isNightShift: false,
      },
    });

    // 9h gross - 1h break = 8h
    expect(full.workedHours).toBe(8);
    // 3h short day keeps full gross (no break deduction)
    expect(short.workedHours).toBe(3);
    expect(short.status).toBe('HALF_DAY');
  });

  it('keeps overnight checkout on original business date math', () => {
    const checkIn = calendarDateTimeToUtc(
      '2026-08-03',
      '22:00',
      'Asia/Kolkata',
    );
    const checkOut = calendarDateTimeToUtc(
      '2026-08-04',
      '06:00',
      'Asia/Kolkata',
    );

    const metrics = calculateAttendanceMetrics({
      checkInTime: checkIn,
      checkOutTime: checkOut,
      attendanceCalendarDate: '2026-08-03',
      timeZone: 'Asia/Kolkata',
      shift: {
        startTime: '22:00',
        endTime: '06:00',
        breakMinutes: 30,
        graceInMinutes: 10,
        graceOutMinutes: 10,
        isNightShift: true,
      },
    });

    // 8h - 30m break
    expect(metrics.workedHours).toBe(7.5);
    expect(toCalendarDate(checkIn, 'Asia/Kolkata')).toBe('2026-08-03');
  });

  it('maps local civil times across a US daylight-saving spring-forward date', () => {
    // 2026-03-08 is the US spring-forward day in America/New_York.
    const before = calendarDateTimeToUtc(
      '2026-03-08',
      '01:30',
      'America/New_York',
    );
    const after = calendarDateTimeToUtc(
      '2026-03-08',
      '03:30',
      'America/New_York',
    );

    expect(toCalendarDate(before, 'America/New_York')).toBe('2026-03-08');
    expect(toCalendarDate(after, 'America/New_York')).toBe('2026-03-08');
    // Local 01:30 EST and 03:30 EDT are two hours apart locally, but only one
    // UTC hour apart because 02:00–03:00 is skipped.
    expect(after.getTime() - before.getTime()).toBe(60 * 60 * 1000);
  });
});
