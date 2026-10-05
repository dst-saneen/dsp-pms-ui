import {
  isValidIanaTimeZone,
  toCalendarDate,
} from '../leave-policy/leave-calendar.util';

export { isValidIanaTimeZone, toCalendarDate };

export const MAX_OPEN_SHIFT_MS = 24 * 60 * 60 * 1000;

/** Store attendanceDate as UTC midnight for the branch-local calendar day. */
export function calendarDateToUtcMidnight(calendarDate: string): Date {
  return new Date(`${calendarDate}T00:00:00.000Z`);
}

export function getTimeZoneParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Convert a branch-local calendar date + HH:mm into a UTC Date. */
export function calendarDateTimeToUtc(
  calendarDate: string,
  timeHHmm: string,
  timeZone: string,
): Date {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const [hour, minute] = timeHHmm.split(':').map(Number);
  let utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const local = getTimeZoneParts(new Date(utcMillis), timeZone);
    const asUtc = Date.UTC(
      local.year,
      local.month - 1,
      local.day,
      local.hour,
      local.minute,
      local.second,
    );
    const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
    utcMillis += desired - asUtc;
  }

  return new Date(utcMillis);
}

export function parseShiftDurationMinutes(
  startTime: string,
  endTime: string,
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  const start = startH * 60 + startM;
  let end = endH * 60 + endM;
  if (end <= start) {
    end += 24 * 60;
  }
  return end - start;
}

export function calculateAttendanceMetrics(params: {
  checkInTime: Date;
  checkOutTime: Date;
  attendanceCalendarDate: string;
  timeZone: string;
  shift?: {
    startTime: string;
    endTime: string;
    breakMinutes: number;
    graceInMinutes: number;
    graceOutMinutes: number;
    isNightShift: boolean;
  } | null;
}): {
  workedHours: number;
  lateMinutes: number;
  earlyDepartureMinutes: number;
  overtimeMinutes: number;
  status: 'PRESENT' | 'HALF_DAY';
} {
  const grossMinutes = Math.max(
    0,
    Math.floor(
      (params.checkOutTime.getTime() - params.checkInTime.getTime()) /
        (1000 * 60),
    ),
  );

  let lateMinutes = 0;
  let earlyDepartureMinutes = 0;
  let overtimeMinutes = 0;
  let workedMinutes = grossMinutes;

  if (params.shift) {
    const shiftStart = calendarDateTimeToUtc(
      params.attendanceCalendarDate,
      params.shift.startTime,
      params.timeZone,
    );
    let shiftEnd = calendarDateTimeToUtc(
      params.attendanceCalendarDate,
      params.shift.endTime,
      params.timeZone,
    );
    if (
      params.shift.isNightShift ||
      shiftEnd.getTime() <= shiftStart.getTime()
    ) {
      shiftEnd = new Date(shiftEnd.getTime() + 24 * 60 * 60 * 1000);
    }

    const graceInEnd = new Date(
      shiftStart.getTime() + params.shift.graceInMinutes * 60 * 1000,
    );
    if (params.checkInTime > graceInEnd) {
      lateMinutes = Math.floor(
        (params.checkInTime.getTime() - shiftStart.getTime()) / (1000 * 60),
      );
    }

    const earlyThreshold = new Date(
      shiftEnd.getTime() - params.shift.graceOutMinutes * 60 * 1000,
    );
    if (params.checkOutTime < earlyThreshold) {
      earlyDepartureMinutes = Math.floor(
        (shiftEnd.getTime() - params.checkOutTime.getTime()) / (1000 * 60),
      );
    }

    if (params.checkOutTime > shiftEnd) {
      overtimeMinutes = Math.floor(
        (params.checkOutTime.getTime() - shiftEnd.getTime()) / (1000 * 60),
      );
    }

    const scheduledMinutes = parseShiftDurationMinutes(
      params.shift.startTime,
      params.shift.endTime,
    );
    const breakThreshold = scheduledMinutes - params.shift.graceOutMinutes;
    if (params.shift.breakMinutes > 0 && grossMinutes >= breakThreshold) {
      workedMinutes = Math.max(0, grossMinutes - params.shift.breakMinutes);
    }
  }

  const workedHours = Number((workedMinutes / 60).toFixed(2));
  return {
    workedHours,
    lateMinutes: Math.max(0, lateMinutes),
    earlyDepartureMinutes: Math.max(0, earlyDepartureMinutes),
    overtimeMinutes: Math.max(0, overtimeMinutes),
    status: workedHours < 4 ? 'HALF_DAY' : 'PRESENT',
  };
}

export function calculateLateMinutes(params: {
  checkInTime: Date;
  attendanceCalendarDate: string;
  timeZone: string;
  shift?: {
    startTime: string;
    graceInMinutes: number;
  } | null;
}): number {
  if (!params.shift) {
    return 0;
  }

  const shiftStart = calendarDateTimeToUtc(
    params.attendanceCalendarDate,
    params.shift.startTime,
    params.timeZone,
  );
  const graceInEnd = new Date(
    shiftStart.getTime() + params.shift.graceInMinutes * 60 * 1000,
  );

  if (params.checkInTime <= graceInEnd) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor(
      (params.checkInTime.getTime() - shiftStart.getTime()) / (1000 * 60),
    ),
  );
}
