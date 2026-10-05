import { Prisma } from '@prisma/client';
import { FinanceSourceType, FinanceTransactionType } from '@prisma/client';

import { DomainConflictException } from '../../../common';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FinanceTransactionValidatorService } from './finance-transaction-validator.service';

describe('FinanceTransactionValidatorService shape matrix', () => {
  const periods = {
    assertOpenPeriodForDate: jest.fn().mockResolvedValue(undefined),
  };
  const scope = {
    parseMoney: (value: string) => new Prisma.Decimal(value),
  };
  const service = new FinanceTransactionValidatorService(
    scope as never,
    periods as never,
  );

  const tx = {
    companyFinancialProfile: {
      findUnique: jest.fn().mockResolvedValue({ baseCurrencyCode: 'INR' }),
    },
    financeCategory: { findFirst: jest.fn() },
    financePaymentAccount: { findFirst: jest.fn() },
    businessParty: { findFirst: jest.fn() },
    employee: { findFirst: jest.fn() },
    department: { findFirst: jest.fn() },
    project: { findFirst: jest.fn() },
  };

  const base = {
    transactionDate: new Date('2026-08-01'),
    amount: '100.00',
    taxAmount: '0',
    currencyCode: 'INR',
  };

  it('rejects income that includes a source account', async () => {
    await expect(
      service.validateMerged(tx as never, 'company-1', {
        ...base,
        transactionType: FinanceTransactionType.INCOME,
        categoryId: 'cat-1',
        destinationAccountId: 'acc-1',
        sourceAccountId: 'acc-2',
        sourceType: FinanceSourceType.MANUAL,
      }),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
    });
  });

  it('rejects a transfer that carries a category', async () => {
    await expect(
      service.validateMerged(tx as never, 'company-1', {
        ...base,
        transactionType: FinanceTransactionType.TRANSFER,
        categoryId: 'cat-1',
        sourceAccountId: 'acc-1',
        destinationAccountId: 'acc-2',
        sourceType: FinanceSourceType.MANUAL,
      }),
    ).rejects.toBeInstanceOf(DomainConflictException);
  });

  it('rejects payroll source through the manual path', async () => {
    await expect(
      service.validateMerged(tx as never, 'company-1', {
        ...base,
        transactionType: FinanceTransactionType.EXPENSE,
        categoryId: 'cat-1',
        sourceAccountId: 'acc-1',
        sourceType: FinanceSourceType.PAYROLL_RUN,
      }),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_TRANSACTION_INVALID_SHAPE,
    });
  });
});
