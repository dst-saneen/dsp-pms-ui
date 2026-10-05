import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  BusinessCalendarRuleMode,
  BusinessCalendarScope,
  BusinessCalendarVersionStatus,
} from '@prisma/client';

import { BusinessCalendarVersionService } from './business-calendar-version.service';

describe('BusinessCalendarVersionService', () => {
  const prisma = {
    businessCalendar: { findFirst: jest.fn() },
    businessCalendarVersion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    businessCalendarWorkingWeekRule: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const employeeDomainScope = {
    companyWhere: jest.fn(() => ({})),
    assertCompanyInScope: jest.fn(),
  };
  const auditService = { log: jest.fn() };
  const outboxWriter = { write: jest.fn() };

  const service = new BusinessCalendarVersionService(
    prisma as never,
    employeeDomainScope as never,
    auditService as never,
    outboxWriter as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('flags incomplete company working week', () => {
    const summary = service.buildValidationSummary({
      calendar: { scope: BusinessCalendarScope.COMPANY },
      workingWeekRules: [
        {
          dayOfWeek: 1,
          ruleMode: BusinessCalendarRuleMode.DEFINE,
          reason: null,
        },
      ],
      events: [],
    });
    expect(summary.readyForReview).toBe(false);
    expect(summary.issues.some((issue) => issue.includes('day 0'))).toBe(true);
  });

  it('accepts complete company working week', () => {
    const summary = service.buildValidationSummary({
      calendar: { scope: BusinessCalendarScope.COMPANY },
      workingWeekRules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        ruleMode: BusinessCalendarRuleMode.DEFINE,
        reason: null,
      })),
      events: [{ id: 'e1' }],
    });
    expect(summary.readyForReview).toBe(true);
  });

  it('accepts sparse branch overrides with reasons', () => {
    const summary = service.buildValidationSummary({
      calendar: { scope: BusinessCalendarScope.BRANCH },
      workingWeekRules: [
        {
          dayOfWeek: 5,
          ruleMode: BusinessCalendarRuleMode.OVERRIDE,
          reason: 'Friday half day',
        },
      ],
      events: [],
    });
    expect(summary.readyForReview).toBe(true);
    expect(summary.inheritanceNote).toMatch(/inherit/i);
  });

  it('rejects branch override without reason on validate', () => {
    expect(() =>
      service.validateWorkingWeekRules(BusinessCalendarScope.BRANCH, [
        {
          dayOfWeek: 5,
          ruleMode: BusinessCalendarRuleMode.OVERRIDE,
          isWorkingDay: false,
        },
      ]),
    ).toThrow(BadRequestException);
  });

  it('assertDraftEditable blocks published versions', () => {
    expect(() =>
      service.assertDraftEditable({
        status: BusinessCalendarVersionStatus.PUBLISHED,
      }),
    ).toThrow(BadRequestException);
  });

  it('submitReview rejects incomplete company week', async () => {
    prisma.businessCalendarVersion.findFirst.mockResolvedValue({
      id: 'v1',
      status: BusinessCalendarVersionStatus.DRAFT,
      optimisticVersion: 1,
      calendar: {
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
      },
      workingWeekRules: [],
      events: [],
    });

    await expect(
      service.submitReview('v1', {}, 'user-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('submitReview rejects stale optimistic version', async () => {
    prisma.businessCalendarVersion.findFirst.mockResolvedValue({
      id: 'v1',
      status: BusinessCalendarVersionStatus.DRAFT,
      optimisticVersion: 2,
      calendar: {
        companyId: 'co-1',
        branchId: null,
        scope: BusinessCalendarScope.COMPANY,
      },
      workingWeekRules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        ruleMode: BusinessCalendarRuleMode.DEFINE,
        reason: null,
      })),
      events: [],
    });

    await expect(
      service.submitReview('v1', { optimisticVersion: 1 }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
