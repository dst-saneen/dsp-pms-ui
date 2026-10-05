import { Prisma } from '@prisma/client';

import { PayrollScopeService } from './payroll-scope.service';

describe('PayrollScopeService decimal helpers', () => {
  const service = new PayrollScopeService(
    {} as never,
    {
      get: jest.fn(),
    } as never,
  );

  it('serializes Decimal amounts as fixed strings', () => {
    expect(service.decimalToString(new Prisma.Decimal('1234.5'))).toBe(
      '1234.50',
    );
    expect(service.decimalToString(null)).toBe('0.00');
  });

  it('rejects negative money inputs', () => {
    expect(() => service.parseMoney('-1.00', 'amount')).toThrow();
  });

  it('parses valid money to Decimal', () => {
    const value = service.parseMoney('10.25', 'amount');
    expect(value.toFixed(2)).toBe('10.25');
  });
});
