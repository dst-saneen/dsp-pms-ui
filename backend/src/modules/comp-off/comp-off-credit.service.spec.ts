import { CompOffCreditService } from './comp-off-credit.service';

describe('CompOffCreditService', () => {
  const prisma = {
    compOffCredit: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };

  const service = new CompOffCreditService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.compOffCredit.findMany.mockResolvedValue([]);
  });

  it('limits expiry candidates to the branch whose local date is being evaluated', async () => {
    await service.expireCredits(new Date('2026-09-18T00:00:00.000Z'), 'br-1');

    const calls = prisma.compOffCredit.findMany.mock.calls as unknown as Array<
      [{ where: { branchId?: string } }]
    >;
    expect(calls).toHaveLength(1);
    expect(calls[0]?.[0].where.branchId).toBe('br-1');
  });
});
