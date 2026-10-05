import {
  FileUploadPurpose,
  FinanceSourceType,
  FinanceTransactionStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import type { OfficeFinanceAccessContext } from '../office-finance-access.types';
import { FINANCE_ERROR_CODES } from '../policies/finance-error-codes';
import { FinanceCapabilityService } from './finance-capability.service';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';
import { FinanceResponseMapper } from './finance-response.mapper';
import { FinanceTransactionValidatorService } from './finance-transaction-validator.service';
import { OfficeFinanceAttachmentsService } from './office-finance-attachments.service';
import { OfficeFinanceDeliveryService } from './office-finance-delivery.service';
import { OfficeFinancePeriodsService } from './office-finance-periods.service';
import { OfficeFinanceReportsService } from './office-finance-reports.service';
import { OfficeFinanceScopeService } from './office-finance-scope.service';
import { OfficeFinanceSettingsService } from './office-finance-settings.service';
import { OfficeFinanceTransactionsService } from './office-finance-transactions.service';

const branchContext = (
  permissions = ['finance.transactions.read'],
): OfficeFinanceAccessContext => ({
  userId: 'finance-branch-user',
  permissions,
  activeCompanyId: 'company-a',
  activeBranchId: 'branch-a',
  scopeLevel: 'BRANCH',
});

const foreignBranchId = '00000000-0000-4000-8000-0000000000b0';

function createScope() {
  const scope = new OfficeFinanceScopeService(
    {} as ConstructorParameters<typeof OfficeFinanceScopeService>[0],
    {} as ConstructorParameters<typeof OfficeFinanceScopeService>[1],
  );
  jest.spyOn(scope, 'assertCompanyScope').mockResolvedValue(undefined);
  return scope;
}

function createTransactionService(
  prisma: {
    financeTransaction: {
      findMany: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
    };
  },
  scope: OfficeFinanceScopeService,
) {
  const receipts = {
    execute: jest.fn(async (...args: unknown[]) => {
      const run = args[4] as (tx: unknown) => Promise<unknown>;
      return run(prisma);
    }),
  };
  const mapper = {
    toPaginated: jest.fn(
      (items: unknown[], total: number, page: number, limit: number) => ({
        items,
        total,
        page,
        limit,
      }),
    ),
  };

  return new OfficeFinanceTransactionsService(
    prisma as unknown as PrismaService,
    scope,
    receipts as unknown as FinanceCommandReceiptService,
    {} as FinanceCapabilityService,
    mapper as unknown as FinanceResponseMapper,
    {} as never,
    {} as OfficeFinanceSettingsService,
    {} as OfficeFinancePeriodsService,
    {} as FinanceTransactionValidatorService,
    {} as OfficeFinanceDeliveryService,
  );
}

describe('Office Finance branch scope', () => {
  it('uses the active Branch for a transaction list, rather than Company-only scope', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn(),
      },
    };
    const service = createTransactionService(prisma, scope);

    await service.findPage({ page: 1, limit: 20 }, branchContext());

    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-a', branchId: 'branch-a' },
      }),
    );
    expect(prisma.financeTransaction.count).toHaveBeenCalledWith({
      where: { companyId: 'company-a', branchId: 'branch-a' },
    });
  });

  it('returns not-found before a branch user can mutate a direct ID from another Branch', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createTransactionService(prisma, scope);

    await expect(
      service.update(
        'transaction-from-branch-b',
        { operationId: 'scope-test-update', expectedVersion: 0 },
        branchContext(['finance.transactions.manage']),
      ),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_RESOURCE_NOT_FOUND,
    });

    expect(prisma.financeTransaction.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'transaction-from-branch-b',
        companyId: 'company-a',
        branchId: 'branch-a',
      },
    });
  });

  it('binds an attachment upload session to the visible transaction and Branch', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'transaction-a',
          branchId: 'branch-a',
          status: FinanceTransactionStatus.DRAFT,
          sourceType: FinanceSourceType.MANUAL,
        }),
      },
      fileUploadSession: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new OfficeFinanceAttachmentsService(
      prisma as unknown as PrismaService,
      scope,
      {} as FinanceCommandReceiptService,
      {} as FinanceCapabilityService,
      {} as never,
      {} as never,
    );

    await expect(
      service.getUploadSession(
        'transaction-a',
        'session-from-another-transaction',
        undefined,
        branchContext(),
      ),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_RESOURCE_NOT_FOUND,
    });

    expect(prisma.fileUploadSession.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'session-from-another-transaction',
        companyId: 'company-a',
        branchId: 'branch-a',
        purpose: FileUploadPurpose.FINANCE_RECEIPT,
        applicationOperationId: 'transaction-a',
      },
      select: { id: true },
    });
  });

  it('uses the same Branch predicate for reports and CSV exports', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OfficeFinanceReportsService(
      prisma as unknown as PrismaService,
      scope,
      {} as never,
    );

    await service.exportCsv({}, branchContext());

    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        branchId: 'branch-a',
        status: {
          in: [
            FinanceTransactionStatus.APPROVED,
            FinanceTransactionStatus.REVERSED,
          ],
        },
      },
      orderBy: [{ transactionDate: 'asc' }, { transactionNumber: 'asc' }],
    });
  });

  it('rejects a foreign Branch report filter before shared report queries run', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findMany: jest.fn(),
      },
    };
    const service = new OfficeFinanceReportsService(
      prisma as unknown as PrismaService,
      scope,
      {} as never,
    );

    await expect(
      service.incomeExpense({ branchId: foreignBranchId }, branchContext()),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_RESOURCE_NOT_FOUND,
    });
    await expect(
      service.exportCsv({ branchId: foreignBranchId }, branchContext()),
    ).rejects.toMatchObject({
      code: FINANCE_ERROR_CODES.FINANCE_RESOURCE_NOT_FOUND,
    });

    expect(prisma.financeTransaction.findMany).not.toHaveBeenCalled();
  });

  it('keeps the Company-wide report Branch filter available', async () => {
    const scope = createScope();
    const prisma = {
      financeTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new OfficeFinanceReportsService(
      prisma as unknown as PrismaService,
      scope,
      {} as never,
    );

    await service.exportCsv(
      { branchId: foreignBranchId },
      {
        ...branchContext(),
        activeBranchId: undefined,
        scopeLevel: 'COMPANY',
      },
    );

    expect(prisma.financeTransaction.findMany).toHaveBeenCalledWith({
      where: {
        companyId: 'company-a',
        branchId: foreignBranchId,
        status: {
          in: [
            FinanceTransactionStatus.APPROVED,
            FinanceTransactionStatus.REVERSED,
          ],
        },
      },
      orderBy: [{ transactionDate: 'asc' }, { transactionNumber: 'asc' }],
    });
  });
});
