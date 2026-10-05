import { DomainConflictException } from '../../../common';
import { PAYROLL_ERROR_CODES } from '../policies/payroll-error-codes';
import { PayrollRunsService } from './payroll-runs.service';

describe('PayrollRunsService preflight degradation', () => {
  it('returns an explicit blocker when run readiness cannot be evaluated', async () => {
    const run = {
      id: 'run-1',
      companyId: 'company-1',
      payrollYear: 2026,
      payrollMonth: 9,
    };
    const mapper = {
      toRunProjection: jest.fn(
        (_run, _context, blockers: unknown[], warnings: unknown[]) => ({
          blockers,
          warnings,
        }),
      ),
    };
    const service = new PayrollRunsService(
      { payrollRun: { findFirst: jest.fn().mockResolvedValue(run) } } as never,
      {
        resolveCompanyId: jest.fn().mockReturnValue('company-1'),
        assertCompanyScope: jest.fn(),
      } as never,
      {} as never,
      {
        evaluate: jest
          .fn()
          .mockRejectedValue(
            new DomainConflictException(
              PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_FAILED,
              'Payroll preflight failed due to a database error.',
            ),
          ),
      } as never,
      {} as never,
      {} as never,
      mapper as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const result = await service.findOne('run-1', {} as never);

    expect(result.blockers).toEqual([
      expect.objectContaining({
        code: PAYROLL_ERROR_CODES.PAYROLL_PREFLIGHT_FAILED,
      }),
    ]);
    expect(result.warnings).toEqual([]);
  });
});
