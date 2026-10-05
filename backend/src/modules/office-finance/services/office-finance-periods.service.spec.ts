import { FinancePeriodStatus } from '@prisma/client';

import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { OfficeFinancePeriodsService } from './office-finance-periods.service';

describe('OfficeFinancePeriodsService period locking', () => {
  function createService() {
    return new OfficeFinancePeriodsService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  it('locks the matching period before validating that it is open', async () => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'period-1', status: FinancePeriodStatus.OPEN },
        ]),
    };

    const period = await createService().assertOpenPeriodForDate(
      tx as never,
      'company-1',
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(period).toEqual({
      id: 'period-1',
      status: FinancePeriodStatus.OPEN,
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a period that becomes locked while it is being validated', async () => {
    const tx = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          { id: 'period-1', status: FinancePeriodStatus.LOCKED },
        ]),
    };

    await expect(
      createService().assertOpenPeriodForDate(
        tx as never,
        'company-1',
        new Date('2026-09-01T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_PERIOD_LOCKED,
    });
  });
});
