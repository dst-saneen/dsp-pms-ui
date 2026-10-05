/** Calendar-week helpers for Projects date-only timesheets. */

/** 0 = Sunday … 6 = Saturday, matching JavaScript Date#getUTCDay. */
export type ProjectWeekStartDay = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export function parseDateOnly(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateOnlyIso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Normalize any instant to UTC midnight of its calendar date. */
export function toUtcDateOnly(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/** Configured week start at 00:00 UTC of the calendar week containing `date`. */
export function weekStartOf(
  date: Date,
  weekStartDay: ProjectWeekStartDay,
): Date {
  const d = toUtcDateOnly(date);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const offset = -((day - weekStartDay + 7) % 7);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/** Backward-compatible Monday week helper. */
export function mondayOfWeek(date: Date): Date {
  return weekStartOf(date, 1);
}

export function weekEndingSunday(periodStart: Date): Date {
  const end = new Date(periodStart);
  end.setUTCDate(end.getUTCDate() + 6);
  return end;
}

export function isDateWithinInclusive(
  workDate: Date,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const d = toUtcDateOnly(workDate).getTime();
  return (
    d >= toUtcDateOnly(periodStart).getTime() &&
    d <= toUtcDateOnly(periodEnd).getTime()
  );
}
