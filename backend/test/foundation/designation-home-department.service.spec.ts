import { ConflictException, NotFoundException } from '@nestjs/common';

import { DesignationService } from '../../src/modules/designation/designation.service';

describe('DesignationService home department', () => {
  function buildService(overrides?: { assertDepartmentInScope?: jest.Mock }) {
    const transactionDesignation = {
      create: jest.fn().mockResolvedValue({
        id: 'des-1',
        companyId: 'company-1',
        departmentId: 'dept-1',
      }),
      update: jest.fn().mockResolvedValue({
        id: 'des-1',
        companyId: 'company-1',
        departmentId: null,
        isActive: true,
      }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'des-1',
        companyId: 'company-1',
        departmentId: null,
        isActive: true,
      }),
    };
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue({ id: 'company-1' }) },
      designation: {
        create: jest.fn().mockResolvedValue({
          id: 'des-1',
          companyId: 'company-1',
          departmentId: 'dept-1',
        }),
        findFirst: jest.fn().mockResolvedValue({
          id: 'des-1',
          companyId: 'company-1',
          departmentId: 'dept-1',
          isActive: true,
        }),
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            designation: transactionDesignation,
          }),
      ),
    };
    const organizationScope = {
      assertCurrentCompany: jest.fn().mockResolvedValue(undefined),
      assertCurrentBranch: jest.fn().mockResolvedValue(undefined),
    };
    const scope = {
      designationWhere: jest.fn().mockReturnValue({ companyId: 'company-1' }),
      assertDepartmentInScope:
        overrides?.assertDepartmentInScope ??
        jest.fn().mockResolvedValue({
          id: 'dept-1',
          companyId: 'company-1',
          branchId: 'branch-1',
        }),
    };
    const numberSeries = {
      next: jest.fn().mockResolvedValue('DES-1'),
    };
    const featureGate = {
      isEnabledForContext: jest.fn().mockReturnValue(true),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const service = new DesignationService(
      prisma as never,
      audit as never,
      organizationScope as never,
      scope as never,
      numberSeries as never,
      featureGate as never,
    );

    return { service, prisma, scope, transactionDesignation };
  }

  it('creates with a same-company home department', async () => {
    const { service, prisma, scope } = buildService();

    await service.create({
      companyId: 'company-1',
      designationName: 'Engineer',
      departmentId: 'dept-1',
    });

    expect(scope.assertDepartmentInScope).toHaveBeenCalledWith(
      'dept-1',
      'company-1',
    );
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects an inaccessible home department', async () => {
    const { service } = buildService({
      assertDepartmentInScope: jest.fn().mockImplementation(() => {
        throw new NotFoundException('Department not found');
      }),
    });

    await expect(
      service.create({
        companyId: 'company-1',
        designationName: 'Engineer',
        departmentId: 'dept-other',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('clears home department when update sends null', async () => {
    const { service, prisma, transactionDesignation } = buildService();
    prisma.designation.findFirst.mockResolvedValue({
      id: 'des-1',
      companyId: 'company-1',
      departmentId: 'dept-1',
      isActive: true,
      company: { id: 'company-1' },
      department: { id: 'dept-1' },
    });

    await service.update('des-1', { departmentId: null });

    expect(transactionDesignation.update).toHaveBeenCalledWith({
      where: { id: 'des-1' },
      data: { departmentId: null, isActive: true },
    });
    expect(transactionDesignation.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'des-1' },
    });
  });

  it('does not treat cross-company home department as valid via scope', async () => {
    const { service } = buildService({
      assertDepartmentInScope: jest.fn().mockResolvedValue({
        id: 'dept-2',
        companyId: 'company-2',
        branchId: 'branch-2',
      }),
    });

    await expect(
      service.create({
        companyId: 'company-1',
        designationName: 'Engineer',
        departmentId: 'dept-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
