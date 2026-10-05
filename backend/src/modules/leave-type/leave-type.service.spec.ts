import { LeaveTypeCategory, Prisma } from '@prisma/client';

import { LeaveTypeService } from './leave-type.service';

describe('LeaveTypeService', () => {
  const prisma = {
    leaveType: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const scope = {
    assertCompanyInScope: jest.fn(),
    leaveTypeWhere: jest.fn().mockReturnValue({}),
  };
  const service = new LeaveTypeService(prisma as never, scope as never);

  beforeEach(() => {
    jest.clearAllMocks();
    scope.assertCompanyInScope.mockResolvedValue(undefined);
    scope.leaveTypeWhere.mockReturnValue({});
    prisma.leaveType.findFirst.mockResolvedValue(null);
    prisma.leaveType.create.mockResolvedValue({ id: 'lt-1' });
  });

  it('retries a generated code after a concurrent unique-key collision', async () => {
    prisma.leaveType.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'already-created' })
      .mockResolvedValueOnce(null);
    prisma.leaveType.create
      .mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      )
      .mockResolvedValueOnce({ id: 'leave-2', leaveCode: 'CL2' });

    await expect(
      service.create({
        companyId: 'co-1',
        leaveName: 'Casual Leave',
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: false,
        carryForwardAllowed: false,
      }),
    ).resolves.toMatchObject({ leaveCode: 'CL2' });

    expect(prisma.leaveType.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({ leaveCode: 'CL' }) as object,
      }),
    );
    expect(prisma.leaveType.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({ leaveCode: 'CL2' }) as object,
      }),
    );
  });

  it('reactivates a soft-deleted leave type with the same name/code', async () => {
    prisma.leaveType.findFirst.mockResolvedValueOnce({
      id: 'lt-old',
      companyId: 'co-1',
      leaveCode: 'CO',
      leaveName: 'Comp-Off',
      isActive: false,
    });
    prisma.leaveType.update.mockResolvedValue({ id: 'lt-old', isActive: true });

    const result = await service.create({
      companyId: 'co-1',
      leaveName: 'Comp-Off',
      category: LeaveTypeCategory.COMP_OFF,
      isPaid: true,
      requiresApproval: true,
      allowHalfDay: true,
      carryForwardAllowed: false,
    });

    expect(prisma.leaveType.create).not.toHaveBeenCalled();
    expect(prisma.leaveType.update).toHaveBeenCalledWith({
      where: { id: 'lt-old' },
      data: expect.objectContaining({
        isActive: true,
        leaveName: 'Comp-Off',
        category: LeaveTypeCategory.COMP_OFF,
      }) as object,
    });
    expect(result).toEqual(expect.objectContaining({ id: 'lt-old' }));
  });

  it('forces paid, no half-day, no carry-forward but keeps requiresApproval for OPTIONAL_HOLIDAY create', async () => {
    await service.create({
      companyId: 'co-1',
      leaveName: 'Optional Holiday',
      category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
      isPaid: false,
      requiresApproval: true,
      allowHalfDay: true,
      carryForwardAllowed: true,
    });

    expect(prisma.leaveType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: false,
        carryForwardAllowed: false,
      }) as object,
    });
  });

  it('allows OPTIONAL_HOLIDAY auto-approve when requiresApproval is false', async () => {
    await service.create({
      companyId: 'co-1',
      leaveName: 'Optional Holiday',
      category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
      isPaid: true,
      requiresApproval: false,
      allowHalfDay: false,
      carryForwardAllowed: false,
    });

    expect(prisma.leaveType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        requiresApproval: false,
      }) as object,
    });
  });

  it('leaves STANDARD flags unchanged on create', async () => {
    await service.create({
      companyId: 'co-1',
      leaveName: 'Casual Leave',
      category: LeaveTypeCategory.STANDARD,
      isPaid: true,
      requiresApproval: true,
      allowHalfDay: true,
      carryForwardAllowed: true,
    });

    expect(prisma.leaveType.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        category: LeaveTypeCategory.STANDARD,
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: true,
        carryForwardAllowed: true,
      }) as object,
    });
  });

  it('forces OPTIONAL_HOLIDAY flags on update when category is set but keeps approval flag', async () => {
    prisma.leaveType.findFirst.mockResolvedValue({
      id: 'lt-1',
      companyId: 'co-1',
      category: LeaveTypeCategory.STANDARD,
      isPaid: true,
      requiresApproval: true,
      allowHalfDay: true,
      carryForwardAllowed: true,
      isActive: true,
    });
    prisma.leaveType.update.mockResolvedValue({ id: 'lt-1' });

    await service.update('lt-1', {
      category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
    });

    expect(prisma.leaveType.update).toHaveBeenCalledWith({
      where: { id: 'lt-1' },
      data: expect.objectContaining({
        category: LeaveTypeCategory.OPTIONAL_HOLIDAY,
        isPaid: true,
        requiresApproval: true,
        allowHalfDay: false,
        carryForwardAllowed: false,
      }) as object,
    });
  });
});
