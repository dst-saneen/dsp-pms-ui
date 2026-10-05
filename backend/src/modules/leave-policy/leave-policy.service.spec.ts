import { BadRequestException } from '@nestjs/common';

import { LeavePolicyService } from './leave-policy.service';

describe('LeavePolicyService entitlement validation', () => {
  const prisma = {
    leavePolicy: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    leaveType: { findFirst: jest.fn() },
  };
  const employeeDomainScope = {
    assertCompanyInScope: jest.fn(),
    assertBranchInScope: jest.fn(),
    assertDepartmentInScope: jest.fn(),
    assertDesignationInScope: jest.fn(),
    leaveTypeWhere: jest.fn().mockReturnValue({}),
    leavePolicyWhere: jest.fn().mockReturnValue({}),
  };
  const service = new LeavePolicyService(
    prisma as never,
    employeeDomainScope as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.assertCompanyInScope.mockResolvedValue(undefined);
    employeeDomainScope.assertBranchInScope.mockResolvedValue(undefined);
    prisma.leaveType.findFirst.mockResolvedValue({ id: 'lt-1' });
    prisma.leavePolicy.findFirst.mockResolvedValue(null);
    prisma.leavePolicy.create.mockResolvedValue({ id: 'pol-1' });
  });

  const baseDto = {
    companyId: 'co-1',
    branchId: 'br-1',
    leaveTypeId: 'lt-1',
    allowNegativeBalance: false,
  };

  it('rejects create when annual entitlement is zero', async () => {
    await expect(
      service.create({ ...baseDto, annualEntitlement: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leavePolicy.create).not.toHaveBeenCalled();
  });

  it('rejects create when annual entitlement is negative', async () => {
    await expect(
      service.create({ ...baseDto, annualEntitlement: -1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects create when annual entitlement exceeds 400', async () => {
    await expect(
      service.create({ ...baseDto, annualEntitlement: 401 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates when annual entitlement is greater than zero', async () => {
    await service.create({ ...baseDto, annualEntitlement: 12 });
    expect(prisma.leavePolicy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ annualEntitlement: 12 }) as object,
    });
  });

  it('rejects update when annual entitlement is zero', async () => {
    prisma.leavePolicy.findFirst.mockResolvedValue({
      id: 'pol-1',
      companyId: 'co-1',
      branchId: 'br-1',
      departmentId: null,
      designationId: null,
      leaveTypeId: 'lt-1',
      isActive: true,
    });

    await expect(
      service.update('pol-1', { annualEntitlement: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leavePolicy.update).not.toHaveBeenCalled();
  });

  it('creates a company-default policy when branchId is omitted', async () => {
    await service.create({
      companyId: 'co-1',
      leaveTypeId: 'lt-1',
      annualEntitlement: 12,
      allowNegativeBalance: false,
    });

    expect(employeeDomainScope.assertBranchInScope).not.toHaveBeenCalled();
    expect(prisma.leavePolicy.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: 'co-1',
        branchId: null,
        departmentId: null,
        designationId: null,
        leaveTypeId: 'lt-1',
        annualEntitlement: 12,
      }) as object,
    });
  });

  it('rejects company-default create when department is set', async () => {
    await expect(
      service.create({
        companyId: 'co-1',
        leaveTypeId: 'lt-1',
        annualEntitlement: 12,
        allowNegativeBalance: false,
        departmentId: 'dept-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.leavePolicy.create).not.toHaveBeenCalled();
  });
});
