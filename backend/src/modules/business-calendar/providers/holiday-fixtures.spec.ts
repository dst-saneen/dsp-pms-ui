import {
  buildCsvTemplate,
  buildExcelTemplate,
  IMPORT_COUNTRY_REQUIRED_ERROR,
  normalizeTabularRow,
  parseCsvBuffer,
  parseExcelBuffer,
  parseIcsBuffer,
  payloadHash,
  validateUploadMeta,
} from '../business-calendar-import.parsers';
import { FixtureGovernmentHolidayProvider } from './fixture-government-holiday.provider';
import { INDIA_2026_FIXTURE, UAE_2026_FIXTURE } from './holiday-fixtures';

describe('Business Calendar import parsers', () => {
  it('builds a CSV template with required headers', () => {
    const csv = buildCsvTemplate();
    expect(csv).toContain('eventName');
    expect(csv).toContain('externalReference');
    expect(csv).toContain('Republic Day');
  });

  it('builds an Excel template that re-parses cleanly', async () => {
    const buffer = await buildExcelTemplate();
    expect(buffer.byteLength).toBeGreaterThan(100);
    const rows = await parseExcelBuffer(buffer);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.normalized?.eventName).toBe('Republic Day');
    expect(rows[0]?.errors).toEqual([]);
  });

  it('parses valid CSV rows and rejects bad dates', () => {
    const csv = [
      'eventName,eventCode,startDate,endDate,countryCode,subdivisionCode,eventType,category,dayPortion,paidHoliday,businessDayEffect,externalReference',
      'Republic Day,IN-RD,2026-01-26,2026-01-26,IN,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,gov:IN:rd',
      'Bad,IN-BAD,26-01-2026,26-01-2026,IN,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,gov:IN:bad',
    ].join('\n');

    const rows = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].normalized?.eventName).toBe('Republic Day');
    expect(rows[1].errors.length).toBeGreaterThan(0);
  });

  it('parses all-day ICS without UTC date shifting', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:rep-day-2026',
      'SUMMARY:Republic Day',
      'DTSTART;VALUE=DATE:20260126',
      'DTEND;VALUE=DATE:20260127',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const rows = parseIcsBuffer(Buffer.from(ics, 'utf8'), {
      countryCode: 'IN',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized?.startDate).toBe('2026-01-26');
    expect(rows[0].normalized?.endDate).toBe('2026-01-26');
    expect(rows[0].normalized?.countryCode).toBe('IN');
    expect(rows[0].normalized?.externalReference).toBe('ics:rep-day-2026');
  });

  it('uses target geography for a CSV row with no explicit country', () => {
    const csv = [
      'eventName,eventCode,startDate,endDate,countryCode,subdivisionCode,eventType,category,dayPortion,paidHoliday,businessDayEffect,externalReference',
      'Company Holiday,CO-HOLIDAY,2026-01-26,2026-01-26,,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,company-holiday',
    ].join('\n');

    const [row] = parseCsvBuffer(Buffer.from(csv, 'utf8'), {
      countryCode: 'IN',
      subdivisionCode: 'IN-KL',
    });

    expect(row?.errors).toEqual([]);
    expect(row?.normalized).toMatchObject({
      countryCode: 'IN',
      subdivisionCode: 'IN-KL',
    });
  });

  it('uses UAE target geography for ICS files rather than assuming India', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:uae-national-day-2026',
      'SUMMARY:UAE National Day',
      'DTSTART;VALUE=DATE:20261202',
      'DTEND;VALUE=DATE:20261203',
      'END:VEVENT',
    ].join('\r\n');

    const [row] = parseIcsBuffer(Buffer.from(ics, 'utf8'), {
      countryCode: 'AE',
      subdivisionCode: 'AE-DU',
    });

    expect(row?.errors).toEqual([]);
    expect(row?.normalized).toMatchObject({
      countryCode: 'AE',
      subdivisionCode: 'AE-DU',
    });
  });

  it('preserves an explicit row country and rejects a missing country without fallback geography', () => {
    const explicit = normalizeTabularRow(
      {
        eventName: 'Explicit India holiday',
        startDate: '2026-01-26',
        endDate: '2026-01-26',
        countryCode: 'IN',
      },
      { countryCode: 'AE', subdivisionCode: 'AE-DU' },
    );
    expect(explicit.errors).toEqual([]);
    expect(explicit.normalized).toMatchObject({
      countryCode: 'IN',
      subdivisionCode: null,
    });

    const missing = normalizeTabularRow({
      eventName: 'Missing geography',
      startDate: '2026-01-26',
      endDate: '2026-01-26',
    });
    expect(missing.normalized).toBeNull();
    expect(missing.errors).toContain(IMPORT_COUNTRY_REQUIRED_ERROR);
  });

  it('rejects ICS recurrence rules', () => {
    const ics = [
      'BEGIN:VEVENT',
      'SUMMARY:Weekly',
      'DTSTART;VALUE=DATE:20260101',
      'RRULE:FREQ=WEEKLY',
      'END:VEVENT',
    ].join('\r\n');

    expect(() => parseIcsBuffer(Buffer.from(ics, 'utf8'))).toThrow(
      /Unsupported ICS recurrence/,
    );
  });

  it('validates upload extension and size', () => {
    expect(
      validateUploadMeta({
        fileName: 'holidays.csv',
        mimeType: 'text/csv',
        size: 10,
      }),
    ).toBeNull();
    expect(
      validateUploadMeta({
        fileName: 'holidays.exe',
        size: 10,
      }),
    ).toMatch(/Unsupported file extension/);
  });

  it('hashes normalized payloads stably', () => {
    const a = payloadHash(INDIA_2026_FIXTURE[0]);
    const b = payloadHash({ ...INDIA_2026_FIXTURE[0] });
    expect(a).toBe(b);
  });
});

describe('FixtureGovernmentHolidayProvider', () => {
  const provider = new FixtureGovernmentHolidayProvider();

  it('advertises only jurisdictions backed by reviewed fixture data', async () => {
    const jurisdictions = await provider.listJurisdictions();

    expect(
      jurisdictions.map((row) => [row.countryCode, row.subdivisionCode]),
    ).toEqual([
      ['IN', null],
      ['IN', 'IN-KL'],
      ['AE', null],
      ['AE', 'AE-DU'],
    ]);
  });

  it('returns India national holidays for 2026', async () => {
    const rows = await provider.fetchHolidays({
      countryCode: 'IN',
      year: 2026,
    });
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((r) => r.subdivisionCode == null)).toBe(true);
    expect(rows.some((r) => r.eventName === 'Independence Day')).toBe(true);
  });

  it('returns Kerala state holidays when subdivision is IN-KL', async () => {
    const rows = await provider.fetchHolidays({
      countryCode: 'IN',
      subdivisionCode: 'IN-KL',
      year: 2026,
    });
    expect(rows.some((r) => r.eventCode === 'IN-KL-ONAM')).toBe(true);
    expect(rows.some((r) => r.subdivisionCode === 'IN-KL')).toBe(true);
    // National holidays are also included for state pack consumers
    expect(rows.some((r) => r.subdivisionCode == null)).toBe(true);
  });

  it('returns UAE fixture for Middle East exit gate', async () => {
    const rows = await provider.fetchHolidays({
      countryCode: 'AE',
      year: 2026,
    });
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(UAE_2026_FIXTURE[0].countryCode).toBe('AE');
    expect(rows.every((r) => r.countryCode === 'AE')).toBe(true);
  });

  it.each([
    {
      input: { countryCode: 'SA', year: 2026 },
      code: 'BUSINESS_CALENDAR_GOVERNMENT_FIXTURE_COUNTRY_UNSUPPORTED',
      detail: 'country SA',
    },
    {
      input: { countryCode: 'IN', year: 2027 },
      code: 'BUSINESS_CALENDAR_GOVERNMENT_FIXTURE_YEAR_UNSUPPORTED',
      detail: 'IN in 2027',
    },
    {
      input: {
        countryCode: 'IN',
        subdivisionCode: 'IN-KA',
        year: 2026,
      },
      code: 'BUSINESS_CALENDAR_GOVERNMENT_FIXTURE_SUBDIVISION_UNSUPPORTED',
      detail: 'subdivision IN-KA',
    },
  ])(
    'fails explicitly for an unsupported fixture: $detail',
    async ({ input, code }) => {
      const request = provider.fetchHolidays(input);

      await expect(request).rejects.toMatchObject({ code });
      await expect(provider.fetchHolidays(input)).rejects.toThrow(
        /controlled CSV, Excel, or ICS import/,
      );
    },
  );
});
