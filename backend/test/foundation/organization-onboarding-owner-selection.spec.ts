import {
  EmployeeCreationSource,
  OrganizationOnboardingStatus,
  OrganizationOnboardingStep,
} from '@prisma/client';

import { OrganizationOnboardingController } from '../../src/modules/organization-onboarding/organization-onboarding.controller';
import { OrganizationOnboardingService } from '../../src/modules/organization-onboarding/organization-onboarding.service';

const selection = {
  companyId: 'company-selected',
  branchId: 'branch-selected',
  departmentId: 'department-selected',
  designationId: 'designation-selected',
};

interface EmployeeCreateArgs {
  data: {
    companyId: string;
    branchId: string;
    departmentId: string;
    designationId: string;
    [key: string]: unknown;
  };
}

function buildService() {
  let employeeCreateArgs: EmployeeCreateArgs | undefined;
  const tx = {
    company: {
      findFirst: jest.fn().mockResolvedValue({ id: selection.companyId }),
    },
    branch: {
      findFirst: jest.fn().mockResolvedValue({ id: selection.branchId }),
    },
    department: {
      findFirst: jest.fn().mockResolvedValue({ id: selection.departmentId }),
    },
    designation: {
      findFirst: jest.fn().mockResolvedValue({
        id: selection.designationId,
        departmentId: selection.departmentId,
      }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ employeeId: null }),
      update: jest.fn().mockResolvedValue({}),
    },
    employee: {
      findUnique: jest.fn(),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn((args: EmployeeCreateArgs) => {
        employeeCreateArgs = args;
        return Promise.resolve({
          id: 'employee-created',
          employeeCode: 'EMP-000001',
          creationSource: EmployeeCreationSource.ORGANIZATION_SETUP,
        });
      }),
    },
  };
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'owner-user',
        email: 'owner@example.test',
        displayName: 'QA Owner',
        username: 'qa.owner',
        employeeId: null,
      }),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      Promise.resolve(callback(tx)),
    ),
  };
  const numberSeries = {
    next: jest.fn().mockResolvedValue('EMP-000001'),
  };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const organizationScope = {
    current: jest.fn().mockReturnValue({
      isGlobal: false,
      activeCompanyGroupId: 'group-active',
    }),
  };

  return {
    service: new OrganizationOnboardingService(
      prisma as never,
      organizationScope as never,
      numberSeries as never,
      auditService as never,
    ),
    prisma,
    tx,
    getEmployeeCreateArgs: () => employeeCreateArgs,
  };
}

describe('OrganizationOnboardingService owner selection', () => {
  it('creates the founding employee with the four explicitly selected IDs', async () => {
    const { service, tx, getEmployeeCreateArgs } = buildService();

    await service.ensureOwnerFoundingEmployee(
      'group-active',
      'owner-user',
      selection,
    );

    expect(tx.company.findFirst).toHaveBeenCalledWith({
      where: {
        id: selection.companyId,
        companyGroupId: 'group-active',
        isActive: true,
      },
      select: { id: true },
    });
    expect(tx.branch.findFirst).toHaveBeenCalledWith({
      where: {
        id: selection.branchId,
        companyId: selection.companyId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(tx.department.findFirst).toHaveBeenCalledWith({
      where: {
        id: selection.departmentId,
        companyId: selection.companyId,
        branchId: selection.branchId,
        isActive: true,
      },
      select: { id: true },
    });
    expect(getEmployeeCreateArgs()).toMatchObject({
      data: {
        companyId: selection.companyId,
        branchId: selection.branchId,
        departmentId: selection.departmentId,
        designationId: selection.designationId,
      },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-user' },
      data: {
        employeeId: 'employee-created',
        defaultCompanyGroupId: 'group-active',
        defaultCompanyId: selection.companyId,
        defaultBranchId: selection.branchId,
      },
    });
  });

  it.each([
    ['companyId', 'company'],
    ['branchId', 'branch'],
    ['departmentId', 'department'],
    ['designationId', 'designation'],
  ] as const)(
    'rejects an inactive or out-of-scope %s',
    async (field, clientName) => {
      const { service, tx } = buildService();
      tx[clientName].findFirst.mockResolvedValueOnce(null);

      await expect(
        service.ensureOwnerFoundingEmployee(
          'group-active',
          'owner-user',
          selection,
        ),
      ).rejects.toMatchObject({
        response: {
          code: 'OWNER_EMPLOYEE_SELECTION_INVALID',
          field,
        },
      });

      expect(tx.employee.create).not.toHaveBeenCalled();
    },
  );

  it('rejects a designation owned by another department', async () => {
    const { service, tx } = buildService();
    tx.designation.findFirst.mockResolvedValueOnce({
      id: selection.designationId,
      departmentId: 'different-department',
    });

    await expect(
      service.ensureOwnerFoundingEmployee(
        'group-active',
        'owner-user',
        selection,
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'OWNER_EMPLOYEE_SELECTION_INVALID',
        field: 'designationId',
      },
    });
  });

  it('reads a stale owner employee link without opening a batch transaction', async () => {
    const onboarding = {
      id: 'onboarding',
      companyGroupId: 'group-active',
      ownerUserId: 'owner-user',
      status: OrganizationOnboardingStatus.COMPLETED,
      currentStep: OrganizationOnboardingStep.COMPLETED,
      completedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const employeeFindFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      organizationOnboarding: {
        findUnique: jest.fn().mockResolvedValue(onboarding),
      },
      employee: { findFirst: employeeFindFirst },
      companyGroup: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'group-active',
          groupCode: 'GROUP',
          groupName: 'Active group',
          description: null,
        }),
      },
      company: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'company-selected',
          companyCode: 'COMPANY',
          companyName: 'Selected company',
          registrationNo: null,
          taxNumber: null,
        }),
      },
      branch: { count: jest.fn().mockResolvedValue(1) },
      department: { count: jest.fn().mockResolvedValue(1) },
      designation: { count: jest.fn().mockResolvedValue(1) },
      shift: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn().mockRejectedValue(new Error('P2028')),
    };
    const service = new OrganizationOnboardingService(
      prisma as never,
      {
        current: jest.fn().mockReturnValue({
          isGlobal: false,
          activeCompanyGroupId: 'group-active',
        }),
      } as never,
      {} as never,
      {} as never,
    );

    const status = await service.getStatus('owner-user');

    expect(employeeFindFirst).toHaveBeenCalledWith({
      where: {
        isActive: true,
        company: {
          companyGroupId: 'group-active',
          isActive: true,
        },
        user: {
          is: { id: 'owner-user' },
        },
      },
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        creationSource: true,
      },
    });
    expect(status.ownerEmployee).toBeNull();
    expect(status.ownerEmployeeLink.state).toBe('NEEDS_REPAIR');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe('OrganizationOnboardingController owner selection', () => {
  it('forwards the explicit selection to completion and repair', async () => {
    const service = {
      complete: jest.fn().mockResolvedValue({ id: 'onboarding' }),
      repairOwnerEmployee: jest.fn().mockResolvedValue({ id: 'onboarding' }),
    };
    const controller = new OrganizationOnboardingController(service as never);
    const request = { user: { id: 'owner-user' } } as never;

    await controller.complete(request, selection);
    await controller.repairOwnerEmployee(request, selection);

    expect(service.complete).toHaveBeenCalledWith('owner-user', selection);
    expect(service.repairOwnerEmployee).toHaveBeenCalledWith(
      'owner-user',
      selection,
    );
  });
});
