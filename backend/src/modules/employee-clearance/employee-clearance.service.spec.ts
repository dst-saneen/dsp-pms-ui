/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matcher types are intentionally dynamic in these query contract tests. */
import type { AuthenticatedUser } from '../auth';

import { EmployeeClearanceService } from './employee-clearance.service';

describe('EmployeeClearanceService queue contract', () => {
  const actor: AuthenticatedUser = {
    id: 'actor-user-id',
    username: 'department-reader',
    employeeId: 'actor-employee-id',
    mustChangePassword: false,
    sessionId: 'session-1',
    authorization: {
      roles: [],
      permissions: ['hr.clearance.department.read'],
      scopeLevel: 'BRANCH',
      isGlobal: false,
      activeCompanyId: 'company-1',
      activeBranchId: 'branch-1',
      availableScopes: [],
    },
  };

  function service(
    prisma: Record<string, unknown>,
    scope: Record<string, unknown> = {},
  ) {
    return new EmployeeClearanceService(
      prisma as never,
      {
        employeeWhere: () => ({ companyId: 'company-1', branchId: 'branch-1' }),
        employeeClearanceWhere: () => ({ companyId: 'company-1' }),
        ...scope,
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
  }

  const item = {
    id: 'clearance-item-1',
    companyId: 'company-1',
    branchId: 'branch-1',
    executorDepartmentId: 'department-it',
    clearanceId: 'clearance-1',
    clearanceType: 'IT',
    itemName: 'Laptop Return',
    status: 'PENDING',
    version: 3,
    clearedDate: null,
    clearedBy: null,
    executorDepartment: {
      id: 'department-it',
      departmentCode: 'IT',
      departmentName: 'Information Technology',
    },
    branch: {
      id: 'branch-1',
      branchCode: 'HQ',
      branchName: 'Head Office',
    },
    clearance: {
      id: 'clearance-1',
      status: 'IN_PROGRESS',
      separationId: 'separation-1',
      separation: {
        id: 'separation-1',
        employeeId: 'employee-1',
        separationType: 'RESIGNATION',
        reason: 'Personal reasons',
        lastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
        createdAt: new Date('2026-09-01T00:00:00.000Z'),
        status: 'CLEARANCE_IN_PROGRESS',
        employee: {
          id: 'employee-1',
          employeeCode: 'EMP-1007',
          firstName: 'Neha',
          lastName: 'Singh',
          company: { companyGroupId: 'group-1' },
          department: {
            id: 'department-ops',
            departmentCode: 'OPS',
            departmentName: 'Operations',
          },
          designation: {
            id: 'designation-ops-exec',
            designationCode: 'OPS_EXEC',
            designationName: 'Operations Executive',
          },
        },
      },
    },
  };

  it('returns employee and separation context while intersecting filters with department scope', async () => {
    const findMany = jest.fn().mockResolvedValue([item]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-1',
          departmentId: 'department-it',
        }),
      },
      employeeClearanceItem: { findMany, count },
    };
    const scopeWhere = { OR: [{ companyId: 'company-1' }] };
    const instance = service(prisma, {
      employeeClearanceWhere: () => scopeWhere,
    });
    const query = {
      queue: 'mine' as const,
      keyword: '  Neha  ',
      branchId: 'branch-filter',
      employeeId: 'employee-1',
      itemType: 'it',
      responsibleDepartmentId: 'department-filter',
      mandatory: true,
      status: 'pending',
      lastWorkingDateFrom: '2026-09-01T00:00:00.000Z',
      lastWorkingDateTo: '2026-09-30',
      page: 2,
      limit: 5,
    };

    const result = await instance.findAll(query, actor);

    const authorizationWhere = {
      clearanceType: { not: 'ASSET' },
      clearance: scopeWhere,
      companyId: 'company-1',
      branchId: 'branch-1',
      executorDepartmentId: 'department-it',
    };
    const filterWhere = expect.objectContaining({
      branchId: 'branch-filter',
      executorDepartmentId: 'department-filter',
      clearanceType: 'IT',
      status: 'PENDING',
      clearance: {
        separation: {
          employeeId: 'employee-1',
          lastWorkingDate: {
            gte: new Date('2026-09-01T00:00:00.000Z'),
            lt: new Date('2026-10-01T00:00:00.000Z'),
          },
        },
      },
      OR: expect.arrayContaining([
        { itemName: { contains: 'Neha', mode: 'insensitive' } },
        {
          clearance: {
            separation: {
              employee: {
                employeeCode: { contains: 'Neha', mode: 'insensitive' },
              },
            },
          },
        },
      ]),
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [authorizationWhere, filterWhere] },
        skip: 5,
        take: 5,
        include: expect.objectContaining({
          branch: {
            select: { id: true, branchCode: true, branchName: true },
          },
        }),
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { AND: [authorizationWhere, filterWhere] },
    });
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      limit: 5,
      items: [
        {
          id: 'clearance-item-1',
          branch: {
            id: 'branch-1',
            branchName: 'Head Office',
          },
          employee: {
            id: 'employee-1',
            employeeCode: 'EMP-1007',
            firstName: 'Neha',
            lastName: 'Singh',
            department: {
              id: 'department-ops',
              departmentName: 'Operations',
            },
            designation: {
              id: 'designation-ops-exec',
              designationName: 'Operations Executive',
            },
          },
          separation: {
            id: 'separation-1',
            separationType: 'RESIGNATION',
            reason: 'Personal reasons',
            lastWorkingDate: new Date('2026-09-30T00:00:00.000Z'),
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        },
      ],
    });
  });

  it('returns no optional manual items because requirement is not stored independently', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          companyId: 'company-1',
          branchId: 'branch-1',
          departmentId: 'department-it',
        }),
      },
      employeeClearanceItem: {
        findMany,
        count: jest.fn().mockResolvedValue(0),
      },
    };

    await service(prisma).findAll(
      { queue: 'mine', mandatory: false, page: 1, limit: 25 },
      actor,
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ id: '__no_optional_clearance_item__' }),
          ]),
        }),
      }),
    );
  });
});
