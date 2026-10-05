import { OvertimeRoundingMode } from '@prisma/client';

import { OvertimePolicyResolverService } from './overtime-policy-resolver.service';

describe('OvertimePolicyResolverService', () => {
  const prisma = {
    overtimePolicy: {
      findFirst: jest.fn(),
    },
  };

  const service = new OvertimePolicyResolverService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('prefers branch overtime policy', async () => {
    prisma.overtimePolicy.findFirst.mockResolvedValueOnce({
      id: 'ot-branch',
      companyId: 'c1',
      branchId: 'b1',
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: null,
      minimumEligibleMinutes: 45,
      roundingMinutes: 15,
      roundingMode: OvertimeRoundingMode.DOWN,
      includeEarlyArrival: false,
      requireScheduledMinutesFulfilled: true,
      allowCompOff: true,
      allowPayrollPending: false,
      compOffHalfDayMinutes: 240,
      compOffFullDayMinutes: 480,
      maxCompOffDaysPerSource: 1,
      compOffExpiryDays: 60,
      maxDailyMinutes: null,
      maxMonthlyMinutes: null,
      requiresApproval: true,
    });

    const result = await service.resolve({
      companyId: 'c1',
      branchId: 'b1',
      asOfDate: '2026-08-01',
    });

    expect(result.source).toBe('BRANCH');
    expect(result.minimumEligibleMinutes).toBe(45);
    expect(result.compOffExpiryDays).toBe(60);
  });

  it('returns system defaults when none configured', async () => {
    prisma.overtimePolicy.findFirst.mockResolvedValue(null);

    const result = await service.resolve({
      companyId: 'c1',
      branchId: null,
      asOfDate: '2026-08-01',
    });

    expect(result).toMatchObject({
      source: 'SYSTEM_DEFAULT',
      policyId: null,
      minimumEligibleMinutes: 30,
      roundingMinutes: 15,
      roundingMode: OvertimeRoundingMode.DOWN,
      includeEarlyArrival: false,
      compOffHalfDayMinutes: 240,
      compOffFullDayMinutes: 480,
      compOffExpiryDays: 90,
    });
  });
});
