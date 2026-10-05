import { BadRequestException } from '@nestjs/common';
import { CalendarImportStatus, CalendarSourceKind } from '@prisma/client';

import { BusinessCalendarErrorCode } from './business-calendar-error-codes';
import { BusinessCalendarImportService } from './business-calendar-import.service';
import { FixtureGovernmentHolidayProvider } from './providers/fixture-government-holiday.provider';

describe('BusinessCalendarImportService government fixture failures', () => {
  it('records an unsupported fixture request as failed and returns actionable guidance', async () => {
    let capturedCreate: { data: Record<string, unknown> } | undefined;
    const createBatch = jest.fn((input: { data: Record<string, unknown> }) => {
      capturedCreate = input;
      return Promise.resolve({ id: 'failed-batch-1' });
    });
    let capturedAudit: unknown[] | undefined;
    const auditLog = jest.fn((...args: unknown[]) => {
      capturedAudit = args;
      return Promise.resolve();
    });
    const prisma = {
      businessCalendarEventSource: {
        findFirst: jest.fn().mockResolvedValue({ id: 'source-1' }),
      },
      businessCalendarImportBatch: {
        create: createBatch,
      },
    };
    const employeeDomainScope = {
      assertCompanyInScope: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = { log: auditLog };
    const versions = {
      requireVersion: jest.fn().mockResolvedValue({
        id: 'version-1',
        calendarId: 'calendar-1',
        calendar: { companyId: 'company-1' },
      }),
      assertDraftEditable: jest.fn(),
    };
    const service = new BusinessCalendarImportService(
      prisma as never,
      employeeDomainScope as never,
      auditService as never,
      versions as never,
      new FixtureGovernmentHolidayProvider(),
    );

    let caught: unknown;
    try {
      await service.importFromGovernment(
        {
          calendarVersionId: 'version-1',
          countryCode: 'IN',
          subdivisionCode: 'IN-KA',
          year: 2026,
        },
        'actor-1',
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse() as Record<
      string,
      unknown
    >;
    expect(response).toMatchObject({
      code: BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_SUBDIVISION_UNSUPPORTED,
      batchId: 'failed-batch-1',
    });
    expect(String(response.message)).toContain(
      'controlled CSV, Excel, or ICS import',
    );
    expect(capturedCreate?.data).toMatchObject({
      status: CalendarImportStatus.FAILED,
      sourceKind: CalendarSourceKind.GOVERNMENT_API,
      totalRows: 0,
    });
    const auditCall = capturedAudit ?? [];
    expect(auditCall.slice(0, 4)).toEqual([
      'BusinessCalendarImportBatch',
      'failed-batch-1',
      'GOVERNMENT_IMPORT_FAILED',
      undefined,
    ]);
    expect(auditCall[4]).toMatchObject({
      providerCode:
        BusinessCalendarErrorCode.CALENDAR_GOVERNMENT_FIXTURE_SUBDIVISION_UNSUPPORTED,
      resumable: true,
    });
    expect(auditCall[5]).toEqual({ userId: 'actor-1' });
  });
});

describe('BusinessCalendarImportService file geography fallback', () => {
  const csvWithNoCountry = Buffer.from(
    [
      'eventName,eventCode,startDate,endDate,countryCode,subdivisionCode,eventType,category,dayPortion,paidHoliday,businessDayEffect,externalReference',
      'Target Calendar Holiday,TARGET-HOLIDAY,2026-01-26,2026-01-26,,,HOLIDAY,GOVERNMENT,FULL_DAY,true,NON_WORKING_DAY,target-calendar-holiday',
    ].join('\n'),
    'utf8',
  );

  function createFileUploadService(geography: {
    company: { legalCountryCode: string | null };
    branch: {
      countryCode: string | null;
      countrySubdivisionCode: string | null;
    } | null;
  }) {
    type CreateRowInput = { data: { normalizedPayload: unknown } };
    type TransactionClient = {
      businessCalendarImportBatch: {
        create: jest.Mock;
        update: jest.Mock;
      };
      businessCalendarImportRow: {
        create: jest.Mock<Promise<{ id: string }>, [CreateRowInput]>;
      };
    };
    type TransactionCallback = (client: TransactionClient) => Promise<unknown>;

    const createRow = jest.fn<Promise<{ id: string }>, [CreateRowInput]>(() =>
      Promise.resolve({ id: 'row-1' }),
    );
    const transaction = jest.fn<Promise<unknown>, [TransactionCallback]>(
      (callback) =>
        callback({
          businessCalendarImportBatch: {
            create: jest.fn().mockResolvedValue({ id: 'batch-1' }),
            update: jest.fn().mockResolvedValue({
              id: 'batch-1',
              rows: [],
              eventSource: { id: 'source-1' },
            }),
          },
          businessCalendarImportRow: { create: createRow },
        }),
    );
    const prisma = {
      businessCalendar: {
        findFirst: jest.fn().mockResolvedValue(geography),
      },
      businessCalendarEventSource: {
        findFirst: jest.fn().mockResolvedValue({ id: 'source-1' }),
      },
      $transaction: transaction,
    };
    const employeeDomainScope = {
      assertCompanyInScope: jest.fn().mockResolvedValue(undefined),
    };
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const versions = {
      requireVersion: jest.fn().mockResolvedValue({
        id: 'version-1',
        calendarId: 'calendar-1',
        calendar: { companyId: 'company-1' },
      }),
      assertDraftEditable: jest.fn(),
    };
    const service = new BusinessCalendarImportService(
      prisma as never,
      employeeDomainScope as never,
      auditService as never,
      versions as never,
      new FixtureGovernmentHolidayProvider(),
    );

    return { service, createRow, transaction };
  }

  it.each([
    {
      name: 'uses the Company legal country for an India calendar',
      geography: {
        company: { legalCountryCode: 'IN' },
        branch: null,
      },
      expected: { countryCode: 'IN', subdivisionCode: null },
    },
    {
      name: 'uses the target Branch country for a UAE calendar',
      geography: {
        company: { legalCountryCode: 'IN' },
        branch: {
          countryCode: 'AE',
          countrySubdivisionCode: 'AE-DU',
        },
      },
      expected: { countryCode: 'AE', subdivisionCode: 'AE-DU' },
    },
  ])('$name', async ({ geography, expected }) => {
    const { service, createRow } = createFileUploadService(geography);

    await service.uploadFile({
      calendarVersionId: 'version-1',
      fileName: 'holidays.csv',
      buffer: csvWithNoCountry,
      actorUserId: 'actor-1',
    });

    const input = createRow.mock.calls[0]?.[0];
    expect(input?.data.normalizedPayload).toMatchObject(expected);
  });

  it('rejects a country-less file when neither Branch nor Company has geography', async () => {
    const { service, transaction } = createFileUploadService({
      company: { legalCountryCode: null },
      branch: null,
    });

    let caught: unknown;
    try {
      await service.uploadFile({
        calendarVersionId: 'version-1',
        fileName: 'holidays.csv',
        buffer: csvWithNoCountry,
        actorUserId: 'actor-1',
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(BadRequestException);
    const response = (caught as BadRequestException).getResponse();
    if (typeof response !== 'object' || response === null) {
      throw new Error('Expected a structured bad-request response.');
    }
    const message = (response as Record<string, unknown>).message;
    expect(typeof message).toBe('string');
    expect(message).toContain('Configure the target Branch country');
    expect(transaction).not.toHaveBeenCalled();
  });
});
