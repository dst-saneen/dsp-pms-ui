import { OFFICE_FINANCE_DELIVERY_EVENTS } from '../office-finance-delivery.events';
import { OfficeFinanceDeliveryService } from './office-finance-delivery.service';

describe('OfficeFinanceDeliveryService', () => {
  it('writes a versioned, recipient-safe transaction event', async () => {
    let emitted: unknown;
    const outbox = {
      write: jest.fn((_tx: unknown, input: unknown) => {
        emitted = input;
        return Promise.resolve({ id: 'evt-1' });
      }),
    };
    const tx = {
      company: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ companyGroupId: 'cg-1' }),
      },
    };
    const service = new OfficeFinanceDeliveryService(outbox as never);

    await service.writeTransactionLifecycle(
      tx as never,
      {
        id: 'transaction-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        status: 'SUBMITTED',
        version: 4,
      } as never,
      OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_SUBMITTED,
    );

    expect(outbox.write).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'FinanceTransaction',
        aggregateId: 'transaction-1',
        eventType: OFFICE_FINANCE_DELIVERY_EVENTS.TRANSACTION_SUBMITTED,
        dedupeKey:
          'office-finance:transaction:transaction-1:office-finance.transaction.submitted:v4',
        companyGroupId: 'cg-1',
        companyId: 'company-1',
        branchId: 'branch-1',
        payload: {
          companyId: 'company-1',
          branchId: 'branch-1',
          status: 'SUBMITTED',
          version: 4,
        },
      }),
    );
    expect(JSON.stringify(emitted)).not.toMatch(
      /reason|remark|recipient|amount|description/i,
    );
  });

  it('writes a company-scoped, versioned period event', async () => {
    const outbox = { write: jest.fn().mockResolvedValue({ id: 'evt-1' }) };
    const tx = {
      company: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ companyGroupId: 'cg-1' }),
      },
    };
    const service = new OfficeFinanceDeliveryService(outbox as never);

    await service.writePeriodLifecycle(
      tx as never,
      {
        id: 'period-1',
        companyId: 'company-1',
        status: 'LOCKED',
        version: 2,
      } as never,
      OFFICE_FINANCE_DELIVERY_EVENTS.PERIOD_LOCKED,
    );

    expect(outbox.write).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        aggregateType: 'FinancePeriod',
        aggregateId: 'period-1',
        branchId: null,
        dedupeKey:
          'office-finance:period:period-1:office-finance.period.locked:v2',
      }),
    );
  });
});
