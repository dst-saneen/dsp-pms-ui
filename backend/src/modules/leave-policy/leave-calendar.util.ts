/**
 * Calendar helpers for leave working-day calculation (D3-03).
 * BranchWorkingDay table arrives in D3-02; until then Mon–Fri is the default.
 */

/** 0 = Sunday … 6 = Saturday */
export const DEFAULT_WORKING_DAYS_OF_WEEK: readonly number[] = [1, 2, 3, 4, 5];

export function isValidIanaTimeZone(timeZone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

/** Normalize a Date or ISO string to a YYYY-MM-DD calendar key in a timezone. */
export function toCalendarDate(value: Date | string, timeZone: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date value');
  }

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Day of week for a YYYY-MM-DD key (0 = Sunday). Uses noon UTC to avoid DST edge flips. */
export function dayOfWeekForCalendarDate(calendarDate: string): number {
  const [year, month, day] = calendarDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

export function enumerateCalendarDates(
  fromCalendarDate: string,
  toCalendarDate: string,
): string[] {
  if (fromCalendarDate > toCalendarDate) {
    return [];
  }

  const dates: string[] = [];
  let cursor = fromCalendarDate;

  while (cursor <= toCalendarDate) {
    dates.push(cursor);
    cursor = addOneCalendarDay(cursor);
  }

  return dates;
}

export function addOneCalendarDay(calendarDate: string): string {
  const [year, month, day] = calendarDate.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1, 12, 0, 0));
  return next.toISOString().slice(0, 10);
}
