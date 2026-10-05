import { DomainConflictException } from '../../../common';
import { FinanceCommandReceiptService } from './finance-command-receipt.service';

describe('FinanceCommandReceiptService HMAC fail-closed', () => {
  it('refuses to hash when the active key is missing', () => {
    const service = new FinanceCommandReceiptService(
      {} as never,
      {
        get: () => undefined,
      } as never,
    );

    expect(() =>
      service.hashRequest('company-1', 'user-1', 'CREATE', {
        operationId: 'op-1',
      }),
    ).toThrow(DomainConflictException);
  });
});
