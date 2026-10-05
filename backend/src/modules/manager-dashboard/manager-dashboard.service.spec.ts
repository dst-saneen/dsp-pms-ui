import { BadRequestException } from '@nestjs/common';

import { BranchTimeService } from '../attendance/branch-time.service';
import { ManagerDashboardService } from './manager-dashboard.service';

describe('ManagerDashboardService', () => {
  const prisma = {
    branch: { findMany: jest.fn() },
    employee: { count: jest.fn(), findMany: jest.fn() },
    attendance: { count: jest.fn(), groupBy: jest.fn() },
    leaveRequest: { count: jest.fn(), findMany: jest.fn() },
    employeeOnboarding: { count: jest.fn() },
    employeeOnboardingTask: { findMany: jest.fn() },
  };

  const organizationScope = {
    current: jest.fn().mockReturnValue({
      scopeLevel: 'COMPANY',
      isGlobal: false,
      activeCompanyId: 'co-1',
    }),
    companyGroupIdOrUndefined: jest.fn().mockReturnValue(undefined),
    companyIdOrUndefined: jest.fn().mockReturnValue('co-1'),
    branchIdOrUndefined: jest.fn().mockReturnValue(undefined),
  };

  const service = new ManagerDashboardService(
    prisma as never,
    organizationScope as never,
    new BranchTimeService(),
  );

  const actor = {
    id: 'user-1',
    username: 'mgr',
    displayName: 'Alex Manager',
    mustChangePassword: false,
    sessionId: 'sess-1',
    authorization: {
      roles: ['HR_MANAGER'],
      permissions: [
        'dashboard.read',
        'hr.employees.read',
        'hr.attendance.read',
        'hr.leave.manage',
        'hr.onboarding.read',
      ],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      activeCompanyId: 'co-1',
      availableScopes: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-1', timezone: 'Asia/Kolkata' },
    ]);
    prisma.employee.count.mockResolvedValue(10);
    prisma.attendance.count.mockResolvedValue(4);
    prisma.leaveRequest.count.mockResolvedValue(1);
    prisma.employeeOnboarding.count.mockResolvedValue(2);
    prisma.employeeOnboardingTask.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.attendance.groupBy.mockResolvedValue([
      { status: 'PRESENT', _count: { _all: 3 } },
      { status: 'ABSENT', _count: { _all: 1 } },
    ]);
    prisma.employee.findMany.mockResolvedValue([]);
  });

  it('returns live source and scoped KPIs', async () => {
    const result = await service.getDashboard(actor);

    expect(result.source).toBe('live');
    expect(result.timezone).toBe('Asia/Kolkata');
    expect(result.kpis).toEqual({
      totalActiveEmployees: 10,
      presentToday: 4,
      onLeaveToday: 1,
      activeOnboardings: 2,
    });
    expect(result.manager.fullName).toBe('Alex Manager');
    expect(result.attendanceOverview[0]).toEqual(
      expect.objectContaining({
        status: 'PRESENT',
        count: 3,
        percentage: 75,
      }),
    );
  });

  it('does not query or return HR dashboard data to a dashboard-only Finance actor', async () => {
    const result = await service.getDashboard({
      ...actor,
      authorization: {
        ...actor.authorization,
        roles: ['FINANCE_MAKER'],
        permissions: ['dashboard.read', 'finance.transactions.manage'],
      },
    });

    expect(result.kpis).toEqual({
      totalActiveEmployees: 0,
      presentToday: 0,
      onLeaveToday: 0,
      activeOnboardings: 0,
    });
    expect(result.pendingOnboardingTasks).toEqual([]);
    expect(result.pendingLeaveApprovals).toEqual([]);
    expect(result.attendanceOverview).toEqual([]);
    expect(result.recentJoiners).toEqual([]);
    expect(prisma.employee.count).not.toHaveBeenCalled();
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
    expect(prisma.attendance.count).not.toHaveBeenCalled();
    expect(prisma.attendance.groupBy).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.count).not.toHaveBeenCalled();
    expect(prisma.leaveRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.employeeOnboarding.count).not.toHaveBeenCalled();
    expect(prisma.employeeOnboardingTask.findMany).not.toHaveBeenCalled();
  });

  it('returns MULTI timezone when branches differ', async () => {
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-1', timezone: 'Asia/Kolkata' },
      { id: 'br-2', timezone: 'Asia/Dubai' },
    ]);

    const result = await service.getDashboard(actor);
    expect(result.timezone).toBe('MULTI');
  });

  it('returns zeros for an empty tenant without fixture data', async () => {
    prisma.branch.findMany.mockResolvedValue([]);
    prisma.employee.count.mockResolvedValue(0);
    prisma.attendance.count.mockResolvedValue(0);
    prisma.leaveRequest.count.mockResolvedValue(0);
    prisma.employeeOnboarding.count.mockResolvedValue(0);
    prisma.attendance.groupBy.mockResolvedValue([]);
    prisma.employee.findMany.mockResolvedValue([]);
    prisma.leaveRequest.findMany.mockResolvedValue([]);
    prisma.employeeOnboardingTask.findMany.mockResolvedValue([]);

    const result = await service.getDashboard(actor);

    expect(result.source).toBe('live');
    expect(result.timezone).toBe('NOT_CONFIGURED');
    expect(result.kpis).toEqual({
      totalActiveEmployees: 0,
      presentToday: 0,
      onLeaveToday: 0,
      activeOnboardings: 0,
    });
    expect(result.pendingLeaveApprovals).toEqual([]);
    expect(result.recentJoiners).toEqual([]);
  });

  it('scopes employee counts to the active branch when set', async () => {
    organizationScope.branchIdOrUndefined.mockReturnValue('br-1');
    organizationScope.current.mockReturnValue({
      scopeLevel: 'BRANCH',
      isGlobal: false,
      activeCompanyId: 'co-1',
      activeBranchId: 'br-1',
    });

    await service.getDashboard(actor);

    expect(prisma.employee.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          branchId: 'br-1',
          isActive: true,
        }) as unknown,
      }),
    );
  });

  it('fails clearly instead of calculating dashboard dates in UTC for a branch without a timezone', async () => {
    prisma.branch.findMany.mockResolvedValue([{ id: 'br-1', timezone: null }]);

    try {
      await service.getDashboard(actor);
      throw new Error('Expected a missing branch-timezone error');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse();
      expect(typeof response).not.toBe('string');
      if (typeof response !== 'string') {
        expect(response).toHaveProperty('code', 'BRANCH_TIMEZONE_REQUIRED');
      }
    }

    expect(prisma.attendance.count).not.toHaveBeenCalled();
  });
});
