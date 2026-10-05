import { createHash } from 'node:crypto';

import { BusinessDayEffect } from '@prisma/client';
import ExcelJS from 'exceljs';

import { assertSupportedImportGeography } from './geographic/jurisdictions';
import type { NormalizedHoliday } from './providers/government-holiday-provider';

export const IMPORT_TEMPLATE_HEADERS = [
  'eventName',
  'eventCode',
  'startDate',
  'endDate',
  'countryCode',
  'subdivisionCode',
  'eventType',
  'category',
  'dayPortion',
  'paidHoliday',
  'businessDayEffect',
  'externalReference',
] as const;

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set(['.csv', '.xlsx', '.xls', '.ics']);
const ALLOWED_MIME = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/calendar',
  'application/ics',
  'application/octet-stream',
]);

export type ParsedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  normalized: NormalizedHoliday | null;
  errors: string[];
};

/**
 * Geography owned by the calendar being imported into. It is used only when
 * the source file does not provide a country or subdivision for a row.
 */
export type ImportGeographyFallback = {
  countryCode?: string | null;
  subdivisionCode?: string | null;
};

export const IMPORT_COUNTRY_REQUIRED_ERROR =
  'countryCode is required when the target calendar geography is not configured';

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\- ()]/g, '_').slice(0, 180);
}

export function detectSourceKind(fileName: string): 'CSV' | 'EXCEL' | 'ICS' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.ics')) return 'ICS';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'EXCEL';
  return 'CSV';
}

export function validateUploadMeta(input: {
  fileName: string;
  mimeType?: string;
  size: number;
}): string | null {
  if (input.size <= 0) return 'Empty file';
  if (input.size > IMPORT_MAX_BYTES) {
    return `File exceeds ${IMPORT_MAX_BYTES} bytes`;
  }
  const lower = input.fileName.toLowerCase();
  const ext = lower.includes('.') ? lower.slice(lower.lastIndexOf('.')) : '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Unsupported file extension: ${ext || '(none)'}`;
  }
  if (input.mimeType && !ALLOWED_MIME.has(input.mimeType)) {
    return `Unsupported MIME type: ${input.mimeType}`;
  }
  return null;
}

export function checksumBuffer(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function payloadHash(payload: NormalizedHoliday): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        eventName: payload.eventName,
        eventCode: payload.eventCode,
        startDate: payload.startDate,
        endDate: payload.endDate,
        countryCode: payload.countryCode,
        subdivisionCode: payload.subdivisionCode,
        eventTypeCode: payload.eventTypeCode,
        categoryCode: payload.categoryCode,
        dayPortion: payload.dayPortion,
        paidHoliday: payload.paidHoliday,
        businessDayEffect: payload.businessDayEffect,
        externalReference: payload.externalReference,
        allDay: payload.allDay,
        startsAt: payload.startsAt ?? null,
        endsAt: payload.endsAt ?? null,
        eventTimezone: payload.eventTimezone ?? null,
      }),
    )
    .digest('hex');
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === '') return fallback;
  const v = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(v)) return true;
  if (['0', 'false', 'no', 'n'].includes(v)) return false;
  throw new Error(`Invalid boolean: ${value}`);
}

function parseDateOnly(value: string | undefined, field: string): string {
  const raw = (value ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  return raw;
}

function mapDayPortionAndEffect(input: {
  dayPortion?: string;
  businessDayEffect?: string;
}): {
  dayPortion: NormalizedHoliday['dayPortion'];
  businessDayEffect: NormalizedHoliday['businessDayEffect'];
} {
  const portion = (input.dayPortion ?? 'FULL_DAY').trim().toUpperCase();
  let effect = (input.businessDayEffect ?? '').trim().toUpperCase();

  if (!effect) {
    if (portion === 'FIRST_HALF') effect = 'FIRST_HALF_NON_WORKING';
    else if (portion === 'SECOND_HALF') effect = 'SECOND_HALF_NON_WORKING';
    else effect = 'NON_WORKING_DAY';
  }

  const dayPortion =
    portion === 'FIRST_HALF' || portion === 'SECOND_HALF'
      ? portion
      : 'FULL_DAY';

  const allowed = new Set(Object.values(BusinessDayEffect));
  if (!allowed.has(effect as BusinessDayEffect)) {
    throw new Error(`Invalid businessDayEffect: ${effect}`);
  }

  return {
    dayPortion,
    businessDayEffect: effect as NormalizedHoliday['businessDayEffect'],
  };
}

export function normalizeTabularRow(
  raw: Record<string, string>,
  fallback: ImportGeographyFallback = {},
): {
  normalized: NormalizedHoliday;
  errors: string[];
} {
  const errors: string[] = [];
  try {
    const eventName = (raw.eventName ?? raw.event_name ?? '').trim();
    if (eventName.length < 2) errors.push('eventName is required');

    const startDate = parseDateOnly(
      raw.startDate ?? raw.start_date ?? raw.date,
      'startDate',
    );
    const endDate = parseDateOnly(
      raw.endDate ?? raw.end_date ?? raw.startDate ?? raw.date ?? startDate,
      'endDate',
    );
    if (endDate < startDate) errors.push('endDate cannot precede startDate');

    const explicitCountryCode = (raw.countryCode ?? raw.country_code ?? '')
      .trim()
      .toUpperCase();
    const fallbackCountryCode = (fallback.countryCode ?? '')
      .trim()
      .toUpperCase();
    const countryCode = explicitCountryCode || fallbackCountryCode;
    const explicitSubdivisionCode = (
      raw.subdivisionCode ??
      raw.subdivision_code ??
      ''
    )
      .trim()
      .toUpperCase();
    const fallbackSubdivisionCode = (fallback.subdivisionCode ?? '')
      .trim()
      .toUpperCase();
    const subdivisionCode =
      explicitSubdivisionCode ||
      (!explicitCountryCode || explicitCountryCode === fallbackCountryCode
        ? fallbackSubdivisionCode
        : '') ||
      null;

    if (!countryCode) errors.push(IMPORT_COUNTRY_REQUIRED_ERROR);

    const geoError = assertSupportedImportGeography({
      countryCode: countryCode || null,
      subdivisionCode,
    });
    if (geoError) errors.push(geoError);

    const { dayPortion, businessDayEffect } = mapDayPortionAndEffect({
      dayPortion: raw.dayPortion ?? raw.day_portion,
      businessDayEffect: raw.businessDayEffect ?? raw.business_day_effect,
    });

    const paidHoliday = parseBool(raw.paidHoliday ?? raw.paid_holiday, true);

    const eventTypeCode = (raw.eventType ?? raw.event_type ?? 'HOLIDAY')
      .trim()
      .toUpperCase();
    const categoryCode = (
      raw.category ??
      raw.eventCategory ??
      (subdivisionCode ? 'REGIONAL' : 'GOVERNMENT')
    )
      .trim()
      .toUpperCase();

    const eventCode =
      (raw.eventCode ?? raw.event_code ?? '').trim().toUpperCase() || null;
    const externalReference =
      (raw.externalReference ?? raw.external_reference ?? '').trim() ||
      (eventCode
        ? `import:${eventCode}:${startDate}`
        : `import:${eventName}:${startDate}`);

    if (errors.length) {
      return { normalized: null as never, errors };
    }

    return {
      normalized: {
        eventName,
        eventCode,
        startDate,
        endDate,
        countryCode,
        subdivisionCode,
        eventTypeCode,
        categoryCode,
        dayPortion,
        paidHoliday,
        businessDayEffect,
        externalReference,
        allDay: true,
      },
      errors: [],
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return { normalized: null as never, errors };
  }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvBuffer(
  buffer: Buffer,
  fallback: ImportGeographyFallback = {},
): ParsedImportRow[] {
  const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.trim().replace(/\s+/g, ''),
  );
  const headerMap = headers.map((h) => {
    const lower = h.toLowerCase();
    const aliases: Record<string, string> = {
      eventname: 'eventName',
      eventcode: 'eventCode',
      startdate: 'startDate',
      enddate: 'endDate',
      date: 'startDate',
      countrycode: 'countryCode',
      subdivisioncode: 'subdivisionCode',
      eventtype: 'eventType',
      category: 'category',
      dayportion: 'dayPortion',
      paidholiday: 'paidHoliday',
      businessdayeffect: 'businessDayEffect',
      externalreference: 'externalReference',
    };
    return aliases[lower] ?? h;
  });

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const raw: Record<string, string> = {};
    headerMap.forEach((key, idx) => {
      raw[key] = cells[idx] ?? '';
    });
    const { normalized, errors } = normalizeTabularRow(raw, fallback);
    rows.push({
      rowNumber: i + 1,
      raw,
      normalized: errors.length ? null : normalized,
      errors,
    });
  }
  return rows;
}

export async function parseExcelBuffer(
  buffer: Buffer,
  fallback: ImportGeographyFallback = {},
): Promise<ParsedImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs typings accept Buffer via any for load
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cell.text ?? cell.value ?? '')
      .trim()
      .replace(/\s+/g, '');
  });

  const alias = (h: string) => {
    const lower = h.toLowerCase();
    const map: Record<string, string> = {
      eventname: 'eventName',
      eventcode: 'eventCode',
      startdate: 'startDate',
      enddate: 'endDate',
      date: 'startDate',
      countrycode: 'countryCode',
      subdivisioncode: 'subdivisionCode',
      eventtype: 'eventType',
      category: 'category',
      dayportion: 'dayPortion',
      paidholiday: 'paidHoliday',
      businessdayeffect: 'businessDayEffect',
      externalreference: 'externalReference',
    };
    return map[lower] ?? h;
  };
  const mappedHeaders = headers.map(alias);

  const rows: ParsedImportRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, string> = {};
    mappedHeaders.forEach((key, idx) => {
      const cell = row.getCell(idx + 1);
      let value = '';
      if (cell.value instanceof Date) {
        value = cell.value.toISOString().slice(0, 10);
      } else if (
        typeof cell.value === 'object' &&
        cell.value &&
        'text' in cell.value
      ) {
        value = String((cell.value as { text?: string }).text ?? '');
      } else {
        value = String(cell.text ?? cell.value ?? '');
      }
      raw[key] = value.trim();
    });
    const { normalized, errors } = normalizeTabularRow(raw, fallback);
    rows.push({
      rowNumber,
      raw,
      normalized: errors.length ? null : normalized,
      errors,
    });
  });
  return rows;
}

/**
 * Minimal ICS parser for all-day DATE values (no UTC day shift).
 * Timed events convert to UTC ISO with timezone evidence on the payload.
 */
export function parseIcsBuffer(
  buffer: Buffer,
  fallback: ImportGeographyFallback = {},
): ParsedImportRow[] {
  const text = buffer.toString('utf8');
  if (/RRULE:/i.test(text)) {
    throw new Error(
      'Unsupported ICS recurrence (RRULE). Export expanded single events and re-import.',
    );
  }

  const events = text.split(/BEGIN:VEVENT/i).slice(1);
  const rows: ParsedImportRow[] = [];
  let rowNumber = 1;

  for (const chunk of events) {
    rowNumber += 1;
    const block = chunk.split(/END:VEVENT/i)[0] ?? '';
    const get = (key: string) => {
      const re = new RegExp(`^${key}[^:]*:(.+)$`, 'im');
      const match = block.match(re);
      return match?.[1]?.trim() ?? '';
    };

    const summary = get('SUMMARY');
    const uid = get('UID');
    const dtStartLine = block.match(/^DTSTART([^\n\r]*)/im)?.[0] ?? '';
    const dtEndLine = block.match(/^DTEND([^\n\r]*)/im)?.[0] ?? '';

    const errors: string[] = [];
    if (!summary) errors.push('ICS SUMMARY is required');

    const isAllDay =
      /VALUE=DATE/i.test(dtStartLine) ||
      /^\d{8}$/.test((dtStartLine.split(':').pop() ?? '').trim());

    let startDate = '';
    let endDate = '';
    let startsAt: string | null = null;
    let endsAt: string | null = null;
    let eventTimezone: string | null = null;

    const startRaw = (dtStartLine.split(':').pop() ?? '').trim();
    const endRaw = (dtEndLine.split(':').pop() ?? '').trim();

    if (isAllDay) {
      // YYYYMMDD — interpret as calendar date, never shift via Date UTC.
      const toDate = (v: string) =>
        `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
      if (!/^\d{8}$/.test(startRaw)) {
        errors.push('ICS all-day DTSTART must be YYYYMMDD');
      } else {
        startDate = toDate(startRaw);
        // DTEND in all-day ICS is exclusive; convert to inclusive end.
        if (/^\d{8}$/.test(endRaw)) {
          const exclusive = toDate(endRaw);
          const d = new Date(`${exclusive}T00:00:00.000Z`);
          d.setUTCDate(d.getUTCDate() - 1);
          endDate = d.toISOString().slice(0, 10);
          if (endDate < startDate) endDate = startDate;
        } else {
          endDate = startDate;
        }
      }
    } else {
      const tzMatch = dtStartLine.match(/TZID=([^;:]+)/i);
      eventTimezone = tzMatch?.[1] ?? 'UTC';
      try {
        const start = parseIcsDateTimeToUtc(startRaw, eventTimezone);
        const end = endRaw
          ? parseIcsDateTimeToUtc(endRaw, eventTimezone)
          : start;
        startDate = start.toISOString().slice(0, 10);
        endDate = end.toISOString().slice(0, 10);
        startsAt = start.toISOString();
        endsAt = end.toISOString();
      } catch (error) {
        errors.push(
          error instanceof Error ? error.message : 'Invalid ICS date-time',
        );
      }
    }

    if (errors.length) {
      rows.push({
        rowNumber,
        raw: { SUMMARY: summary, UID: uid },
        normalized: null,
        errors,
      });
      continue;
    }

    const countryCode = (fallback.countryCode ?? '').trim().toUpperCase();
    const subdivisionCode =
      (fallback.subdivisionCode ?? '').trim().toUpperCase() || null;
    if (!countryCode) errors.push(IMPORT_COUNTRY_REQUIRED_ERROR);
    const geoError = assertSupportedImportGeography({
      countryCode: countryCode || null,
      subdivisionCode,
    });
    if (geoError) errors.push(geoError);

    if (errors.length) {
      rows.push({
        rowNumber,
        raw: { SUMMARY: summary, UID: uid, DTSTART: startRaw, DTEND: endRaw },
        normalized: null,
        errors,
      });
      continue;
    }

    const normalized: NormalizedHoliday = {
      eventName: summary,
      eventCode: null,
      startDate,
      endDate,
      countryCode,
      subdivisionCode,
      eventTypeCode: 'HOLIDAY',
      categoryCode: 'GOVERNMENT',
      dayPortion: 'FULL_DAY',
      paidHoliday: true,
      businessDayEffect: 'NON_WORKING_DAY',
      externalReference: uid ? `ics:${uid}` : `ics:${summary}:${startDate}`,
      allDay: isAllDay,
      startsAt,
      endsAt,
      eventTimezone: isAllDay ? null : eventTimezone,
    };

    rows.push({
      rowNumber,
      raw: { SUMMARY: summary, UID: uid, DTSTART: startRaw, DTEND: endRaw },
      normalized,
      errors: [],
    });
  }

  return rows;
}

function parseIcsDateTimeToUtc(raw: string, tzid: string): Date {
  // Forms: 20260815T090000Z or 20260815T090000
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) {
    throw new Error(`Unsupported ICS date-time: ${raw}`);
  }
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  if (m[7] === 'Z' || tzid.toUpperCase() === 'UTC') {
    return new Date(`${iso}.000Z`);
  }
  // Evidence of local timezone kept on payload; convert via Date as local approximation
  // using explicit offset-less ISO tagged with timezone string (not silently date-shifted all-day).
  const asUtc = new Date(`${iso}.000Z`);
  if (Number.isNaN(asUtc.getTime())) {
    throw new Error(`Invalid ICS date-time: ${raw}`);
  }
  return asUtc;
}

export function buildCsvTemplate(): string {
  const header = IMPORT_TEMPLATE_HEADERS.join(',');
  const sample = [
    'Republic Day',
    'IN-REPUBLIC-DAY',
    '2026-01-26',
    '2026-01-26',
    'IN',
    '',
    'HOLIDAY',
    'GOVERNMENT',
    'FULL_DAY',
    'true',
    'NON_WORKING_DAY',
    'template:IN:republic-day',
  ].join(',');
  return `${header}\n${sample}\n`;
}

/** Same columns as CSV; first sheet only — Excel import reads worksheet 1. */
export async function buildExcelTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Holidays');
  sheet.addRow([...IMPORT_TEMPLATE_HEADERS]);
  sheet.addRow([
    'Republic Day',
    'IN-REPUBLIC-DAY',
    '2026-01-26',
    '2026-01-26',
    'IN',
    '',
    'HOLIDAY',
    'GOVERNMENT',
    'FULL_DAY',
    true,
    'NON_WORKING_DAY',
    'template:IN:republic-day',
  ]);
  sheet.getRow(1).font = { bold: true };
  IMPORT_TEMPLATE_HEADERS.forEach((_, index) => {
    sheet.getColumn(index + 1).width = 18;
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function parseImportFile(input: {
  fileName: string;
  buffer: Buffer;
  fallbackGeography?: ImportGeographyFallback;
}): Promise<ParsedImportRow[]> {
  const kind = detectSourceKind(input.fileName);
  if (kind === 'ICS')
    return parseIcsBuffer(input.buffer, input.fallbackGeography);
  if (kind === 'EXCEL') {
    return parseExcelBuffer(input.buffer, input.fallbackGeography);
  }
  return parseCsvBuffer(input.buffer, input.fallbackGeography);
}
