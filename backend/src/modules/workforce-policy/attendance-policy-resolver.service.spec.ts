import { AttendancePolicyResolverService } from './attendance-policy-resolver.service';

describe('AttendancePolicyResolverService', () => {
  const prisma = {
    attendancePolicy: {
      findFirst: jest.fn(),
    },
  };

  const service = new AttendancePolicyResolverService(prisma as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('prefers branch policy over company policy', async () => {
    prisma.attendancePolicy.findFirst
      .mockResolvedValueOnce({
        id: 'branch',
        companyId: 'c1',
        branchId: 'b1',
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        lateGraceMinutes: 20,
        earlyDepartureGraceMinutes: 10,
        fullDayThresholdPercent: 95,
        halfDayThresholdPercent: 40,
        regularizationWindowDays: 2,
        leaveBackdateWindowDays: 2,
        finalizationDelayMinutes: 120,
        maxOpenShiftMinutes: 1000,
        latePenaltyEnabled: true,
        automaticLeaveDeductionEnabled: false,
      })
      .mockResolvedValueOnce(null);

    const result = await service.resolve({
      companyId: 'c1',
      branchId: 'b1',
      asOfDate: '2026-08-01',
    });

    expect(result.source).toBe('BRANCH');
    expect(result.policyId).toBe('branch');
    expect(result.lateGraceMinutes).toBe(20);
    expect(prisma.attendancePolicy.findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to company policy when no branch policy', async () => {
    prisma.attendancePolicy.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'company',
        companyId: 'c1',
        branchId: null,
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: null,
        lateGraceMinutes: 25,
        earlyDepartureGraceMinutes: 15,
        fullDayThresholdPercent: 90,
        halfDayThresholdPercent: 50,
        regularizationWindowDays: 3,
        leaveBackdateWindowDays: 3,
        finalizationDelayMinutes: 180,
        maxOpenShiftMinutes: 1440,
        latePenaltyEnabled: false,
        automaticLeaveDeductionEnabled: false,
      });

    const result = await service.resolve({
      companyId: 'c1',
      branchId: 'b1',
      asOfDate: '2026-08-01',
    });

    expect(result.source).toBe('COMPANY');
    expect(result.policyId).toBe('company');
    expect(result.lateGraceMinutes).toBe(25);
  });

  it('returns locked system defaults when no policy configured', async () => {
    prisma.attendancePolicy.findFirst.mockResolvedValue(null);

    const result = await service.resolve({
      companyId: 'c1',
      branchId: 'b1',
      asOfDate: '2026-08-01',
    });

    expect(result).toMatchObject({
      source: 'SYSTEM_DEFAULT',
      policyId: null,
      lateGraceMinutes: 30,
      fullDayThresholdPercent: 90,
      halfDayThresholdPercent: 50,
      regularizationWindowDays: 3,
      finalizationDelayMinutes: 180,
    });
  });
});
