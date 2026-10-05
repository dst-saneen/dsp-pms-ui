import { CompOffAllocationStatus, CompOffCreditStatus } from '@prisma/client';

import { CompOffAllocationService } from './comp-off-allocation.service';

/* Nested Jest asymmetric matchers are typed as any. */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

describe('CompOffAllocationService', () => {
  const service = new CompOffAllocationService();

  it('reserves credits FIFO by earliest expiry', async () => {
    const tx = {
      compOffAllocation: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest
          .fn()
          .mockResolvedValueOnce({ id: 'a1' })
          .mockResolvedValueOnce({ id: 'a2' }),
      },
      compOffCredit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'c-early',
            availableDays: 0.5,
            reservedDays: 0,
            usedDays: 0,
            expiresOn: new Date('2026-09-01'),
          },
          {
            id: 'c-late',
            availableDays: 1,
            reservedDays: 0,
            usedDays: 0,
            expiresOn: new Date('2026-10-01'),
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const result = await service.reserveForLeaveRequest({
      tx: tx as never,
      companyId: 'co-1',
      branchId: 'br-1',
      employeeId: 'emp-1',
      leaveTypeId: 'lt-comp',
      leaveRequestId: 'lr-1',
      requestedDays: 1,
      asOfDate: new Date('2026-08-03'),
    });

    expect(result).toHaveLength(2);
    expect(tx.compOffCredit.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 'c-early' }),
        data: expect.objectContaining({
          availableDays: 0,
          reservedDays: 0.5,
          status: CompOffCreditStatus.RESERVED,
        }),
      }),
    );
    expect(tx.compOffAllocation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: CompOffAllocationStatus.RESERVED,
          allocatedDays: 0.5,
        }),
      }),
    );
  });
});
