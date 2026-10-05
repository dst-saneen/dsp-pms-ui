import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ReportingTeamScopeService } from './reporting-team-scope.service';

describe('ReportingTeamScopeService', () => {
  const prisma = {
    employee: {
      findMany: jest.fn(),
    },
  };
  const employeeDomainScope = {
    employeeWhere: jest.fn().mockReturnValue({}),
    assertEmployeeInScope: jest.fn(),
    notFound: jest.fn((entity: string): never => {
      throw new NotFoundException(`${entity} not found`);
    }),
  };

  const service = new ReportingTeamScopeService(
    prisma as never,
    employeeDomainScope as never,
  );

  const baseActor = {
    id: 'user-1',
    username: 'mgr',
    mustChangePassword: false,
    sessionId: 's1',
    employeeId: 'mgr-emp',
    authorization: {
      roles: [],
      permissions: [] as string[],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      activeCompanyId: 'co-1',
      availableScopes: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.employeeWhere.mockReturnValue({});
  });

  it('returns SELF when no calendar or team permissions', async () => {
    const visibility = await service.resolveVisibility(baseActor);
    expect(visibility.mode).toBe('SELF');
    expect(visibility.employeeIds).toEqual(['mgr-emp']);
  });

  it('returns TEAM with direct reports for hr.team.read', async () => {
    prisma.employee.findMany.mockResolvedValue([
      { id: 'rep-1' },
      { id: 'rep-2' },
    ]);
    const visibility = await service.resolveVisibility({
      ...baseActor,
      authorization: {
        ...baseActor.authorization,
        permissions: ['hr.team.read'],
      },
    });
    expect(visibility.mode).toBe('TEAM');
    expect(visibility.employeeIds).toEqual(['mgr-emp', 'rep-1', 'rep-2']);
  });

  it('returns TENANT for hr.calendar.read', async () => {
    const visibility = await service.resolveVisibility({
      ...baseActor,
      authorization: {
        ...baseActor.authorization,
        permissions: ['hr.calendar.read'],
      },
    });
    expect(visibility.mode).toBe('TENANT');
    expect(visibility.employeeIds).toBeNull();
  });

  it('blocks team visibility without linked employee', async () => {
    await expect(
      service.resolveVisibility({
        ...baseActor,
        employeeId: undefined,
        authorization: {
          ...baseActor.authorization,
          permissions: ['hr.team.read'],
        },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when a manager asks for an employee outside the reporting team', async () => {
    prisma.employee.findMany.mockResolvedValue([{ id: 'rep-1' }]);

    await expect(
      service.assertEmployeeVisible(
        {
          ...baseActor,
          authorization: {
            ...baseActor.authorization,
            permissions: ['hr.team.read'],
          },
        },
        'foreign-emp',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(employeeDomainScope.notFound).toHaveBeenCalledWith('Employee');
  });

  it('scopes HR calendar employees through tenant isolation', async () => {
    employeeDomainScope.assertEmployeeInScope.mockResolvedValue({
      id: 'emp-scoped',
    });

    await service.assertEmployeeVisible(
      {
        ...baseActor,
        authorization: {
          ...baseActor.authorization,
          permissions: ['hr.calendar.read'],
        },
      },
      'emp-scoped',
    );

    expect(employeeDomainScope.assertEmployeeInScope).toHaveBeenCalledWith(
      'emp-scoped',
    );
  });
});
