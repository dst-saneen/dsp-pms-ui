import { DomainConflictException } from '../../../common';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PayrollPreflightService } from './payroll-preflight.service';

describe('PayrollPreflightService fail-closed', () => {
  it('does not report can-calculate when a database query throws', async () => {
    const service = new PayrollPreflightService(
      {
        companyFinancialProfile: {
          findUnique: jest.fn().mockRejectedValue(new Error('connection lost')),
        },
      } as never,
      {
        getPeriodBounds: () => ({
          periodStart: new Date('2026-08-01'),
          periodEnd: new Date('2026-08-31'),
        }),
      } as never,
      {
        isEnabledForCompany: () => true,
      } as never,
      {
        getReadiness: () =>
          Promise.resolve({ enabled: true, blockedReasons: [] }),
      } as never,
    );

    await expect(service.evaluate('company-1', 2026, 8)).rejects.toBeInstanceOf(
      DomainConflictException,
    );

    try {
      await service.evaluate('company-1', 2026, 8);
    } catch (error) {
      expect(error).toBeInstanceOf(DomainConflictException);
      expect((error as DomainConflictException).code).toBe(
        PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_FAILED,
      );
    }
  });
});
