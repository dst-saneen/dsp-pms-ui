import { format, isValid, parse, parseISO } from "date-fns";

/** ISO calendar date stored by forms (`yyyy-MM-dd`). */
export const APP_DATE_VALUE_FORMAT = "yyyy-MM-dd";

/** Display format for date triggers (Sneat-style readable). */
export const APP_DATE_DISPLAY_FORMAT = "MMM d, yyyy";

/** 24h time stored by forms (`HH:mm`). */
export const APP_TIME_VALUE_FORMAT = "HH:mm";

export function parseAppDate(value?: string | null): Date | undefined {
  if (!value) return undefined;

  const fromIso = parseISO(value);
  if (isValid(fromIso) && value.includes("-") && value.length >= 10) {
    return fromIso;
  }

  const fromPattern = parse(value, APP_DATE_VALUE_FORMAT, new Date());
  return isValid(fromPattern) ? fromPattern : undefined;
}

export function formatAppDateValue(date: Date): string {
  return format(date, APP_DATE_VALUE_FORMAT);
}

export function formatAppDateDisplay(date: Date): string {
  return format(date, APP_DATE_DISPLAY_FORMAT);
}

export function parseAppTime(value?: string | null): {
  hours: number;
  minutes: number;
} | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return { hours, minutes };
}

export function formatAppTimeValue(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatAppTimeDisplay(value?: string | null): string {
  const parsed = parseAppTime(value);
  if (!parsed) return "";
  return formatAppTimeValue(parsed.hours, parsed.minutes);
}
