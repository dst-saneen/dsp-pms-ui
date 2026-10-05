import { BadRequestException, NotFoundException } from '@nestjs/common';

import { WorkforceErrorCode } from '../../common/constants';

import { SelfServiceContextService } from './self-service-context.service';

describe('SelfServiceContextService', () => {
  const prisma = {
    employee: {
      findUnique: jest.fn(),
    },
  };

  const service = new SelfServiceContextService(prisma as never);

  const actor = {
    id: 'user-1',
    username: 'emp',
    mustChangePassword: false,
    sessionId: 'sess-1',
    employeeId: 'emp-1',
    authorization: {
      roles: [],
      permissions: [],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      availableScopes: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws EMPLOYEE_LINK_REQUIRED when user has no employee link', async () => {
    await expect(
      service.resolve({ ...actor, employeeId: undefined }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects inactive linked employees', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      employeeCode: 'E1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      employmentStatus: 'ACTIVE',
      isActive: false,
      companyId: 'co-1',
      branchId: 'br-1',
      departmentId: 'dept-1',
      designationId: 'desig-1',
      company: { id: 'co-1', companyName: 'Acme' },
      branch: { id: 'br-1', branchName: 'HQ', timezone: 'Asia/Kolkata' },
      department: { id: 'dept-1', departmentName: 'Engineering' },
      designation: { id: 'desig-1', designationName: 'Engineer' },
    });

    await expect(service.resolve(actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('resolves employee company branch department designation', async () => {
    prisma.employee.findUnique.mockResolvedValue({
      id: 'emp-1',
      employeeCode: 'E1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      employmentStatus: 'ACTIVE',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
      departmentId: 'dept-1',
      designationId: 'desig-1',
      company: { id: 'co-1', companyName: 'Acme' },
      branch: { id: 'br-1', branchName: 'HQ', timezone: 'Asia/Kolkata' },
      department: { id: 'dept-1', departmentName: 'Engineering' },
      designation: { id: 'desig-1', designationName: 'Engineer' },
    });

    const context = await service.resolve(actor);

    expect(context.employeeId).toBe('emp-1');
    expect(context.timezone).toBe('Asia/Kolkata');
    expect(context.company.companyName).toBe('Acme');
  });
});

describe('WorkforceErrorCode for self-service', () => {
  it('includes EMPLOYEE_LINK_REQUIRED', () => {
    expect(WorkforceErrorCode.EMPLOYEE_LINK_REQUIRED).toBe(
      'EMPLOYEE_LINK_REQUIRED',
    );
  });
});
