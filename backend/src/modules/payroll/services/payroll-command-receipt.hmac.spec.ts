import { DomainConflictException } from '../../../common';
import { PayrollCommandReceiptService } from './payroll-command-receipt.service';

describe('PayrollCommandReceiptService HMAC fail-closed', () => {
  it('refuses to hash when the active key is missing', () => {
    const service = new PayrollCommandReceiptService(
      {} as never,
      {
        get: () => undefined,
      } as never,
    );

    expect(() =>
      service.hashRequest('company-1', 'user-1', 'CREATE_RUN', {
        operationId: 'op-1',
      }),
    ).toThrow(DomainConflictException);
  });
});
