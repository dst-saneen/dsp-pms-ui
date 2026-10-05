import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { assertSupportedImportGeography } from './geographic/jurisdictions';
import {
  checksumBuffer,
  IMPORT_MAX_BYTES,
  normalizeTabularRow,
  parseCsvBuffer,
  parseIcsBuffer,
  payloadHash,
  validateUploadMeta,
} from './business-calendar-import.parsers';
import { BUSINESS_CALENDAR_PERMISSIONS } from './business-calendar.permissions';
import { buildBusinessCalendarScopeKey } from './business-calendar-scope.util';

describe('Stage 9 import & foundation gates', () => {
  it('rejects invalid country/subdivision on normalize', () => {
    const { errors } = normalizeTabularRow({
      eventName: 'Bad geo',
      startDate: '2026-01-26',
      endDate: '2026-01-26',
      countryCode: 'IN',
      subdivisionCode: 'IN-XX',
      eventType: 'HOLIDAY',
      category: 'GOVERNMENT',
      dayPortion: 'FULL_DAY',
      paidHoliday: 'true',
      businessDayEffect: 'NON_WORKING_DAY',
      externalReference: 'bad-geo',
    });
    expect(errors.some((e) => /subdivision/i.test(e))).toBe(true);
    expect(
      assertSupportedImportGeography({
        countryCode: 'IN',
        subdivisionCode: 'IN-KL',
      }),
    ).toBeNull();
  });

  it('rejects oversized uploads', () => {
    expect(
      validateUploadMeta({
        fileName: 'huge.csv',
        mimeType: 'text/csv',
        size: IMPORT_MAX_BYTES + 1,
      }),
    ).toMatch(/exceeds/i);
  });

  it('detects duplicate payload hashes for idempotency', () => {
    const csv = [
      'eventName,eventCode,startDate,endDate,countryCode,subdivisionCode,eventType,category,dayPortion,paidHoliday,businessDayEffect,externalReference',
      'Republic Day,IN-RD,2026-01-26,2026-01-26,IN,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,gov:IN:rd',
      'Republic Day,IN-RD,2026-01-26,2026-01-26,IN,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,gov:IN:rd',
    ].join('\n');
    const rows = parseCsvBuffer(Buffer.from(csv, 'utf8'));
    expect(rows).toHaveLength(2);
    expect(payloadHash(rows[0].normalized!)).toBe(
      payloadHash(rows[1].normalized!),
    );
    expect(rows[0].normalized!.externalReference).toBe(
      rows[1].normalized!.externalReference,
    );
  });

  it('checksum is stable for identical file bytes', () => {
    const buffer = Buffer.from('a,b\n1,2\n', 'utf8');
    expect(checksumBuffer(buffer)).toBe(checksumBuffer(buffer));
  });

  it('rejects unsupported ICS recurrence (import gate)', () => {
    expect(() =>
      parseIcsBuffer(
        Buffer.from(
          'BEGIN:VEVENT\nSUMMARY:X\nDTSTART;VALUE=DATE:20260101\nRRULE:FREQ=YEARLY\nEND:VEVENT',
          'utf8',
        ),
      ),
    ).toThrow(/recurrence/i);
  });

  it('permission catalog includes import, publish, amend, protected-override', () => {
    expect(BUSINESS_CALENDAR_PERMISSIONS).toEqual(
      expect.arrayContaining([
        'calendar.business.read',
        'calendar.business.manage',
        'calendar.business.review',
        'calendar.business.publish',
        'calendar.business.amend',
        'calendar.business.import',
        'calendar.business.runtime.preview',
        'calendar.business.protected-override',
      ]),
    );
  });

  it('scope keys remain unique shapes for company and branch', () => {
    expect(buildBusinessCalendarScopeKey('COMPANY', 'co-1')).toBe(
      'COMPANY:co-1',
    );
    expect(buildBusinessCalendarScopeKey('BRANCH', 'br-1')).toBe('BRANCH:br-1');
  });

  it('foundation migration encodes uniqueness and current-runtime partial unique', () => {
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../../prisma/migrations/20260807140000_business_calendar_foundation/migration.sql',
      ),
      'utf8',
    );
    expect(sql).toContain('business_calendars_scopeKey_key');
    expect(sql).toContain('bc_runtime_days_current_office_date_key');
    expect(sql).toContain('WHERE "isCurrent" = true');
    expect(sql).toContain('Published effective-range overlap protection');
    expect(sql).toContain('leave_request_calendar_days');
    expect(sql).toContain('business_calendar_import_batches');
  });
});
