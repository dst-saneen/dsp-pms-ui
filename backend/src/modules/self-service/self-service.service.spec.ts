import { ForbiddenException } from '@nestjs/common';

import { SelfServiceService } from './self-service.service';

describe('SelfServiceService', () => {
  const contextService = {
    resolve: jest.fn(),
  };
  const employeeLeaveService = {
    getProfile: jest.fn(),
    getSummary: jest.fn(),
  };
  const leaveRequestService = {
    create: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    cancel: jest.fn(),
    findOne: jest.fn(),
  };
  const attendanceService = {
    getTodayAttendance: jest.fn(),
    checkIn: jest.fn(),
    checkOut: jest.fn(),
    findOne: jest.fn(),
  };
  const attendanceRegularizationService = {
    findAll: jest.fn(),
    submit: jest.fn(),
  };
  const branchTime = {
    requireTimezone: jest.fn((timezone: string | null | undefined) => {
      if (!timezone) {
        throw new Error('BRANCH_TIMEZONE_REQUIRED');
      }
      return timezone;
    }),
  };
  const employeeDocumentService = {
    findByEmployee: jest.fn(),
    employeeSummary: jest.fn(),
  };
  const employeeAssetService = {
    findByEmployee: jest.fn(),
  };
  const assetSelfServiceQuery = {
    findCurrentByEmployee: jest.fn(),
    findMyAssets: jest.fn(),
  };
  const assetGrantQuery = {
    findMyGrantedDepartments: jest.fn(),
  };
  const employeeOnboardingRepository = {
    findActiveByEmployee: jest.fn(),
    findByEmployee: jest.fn(),
  };
  const overtimeRequestService = {
    findMine: jest.fn(),
    submit: jest.fn(),
    cancel: jest.fn(),
  };
  const compOffCreditService = {
    findMine: jest.fn(),
  };
  const workforceCalendarService = {
    getSelfCalendar: jest.fn(),
  };
  const workScheduleItemService = {
    getEmployeeTodayItems: jest.fn(),
  };
  const prisma = {
    leaveType: {
      findMany: jest.fn(),
    },
    leaveRequest: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    shiftRosterEntry: {
      findMany: jest.fn(),
    },
    attendanceException: {
      findMany: jest.fn(),
    },
  };

  const leavePolicyResolver = {
    resolveCalculation: jest.fn(),
  };

  const service = new SelfServiceService(
    contextService as never,
    employeeLeaveService as never,
    leaveRequestService as never,
    leavePolicyResolver as never,
    attendanceService as never,
    attendanceRegularizationService as never,
    branchTime as never,
    employeeDocumentService as never,
    employeeAssetService as never,
    assetSelfServiceQuery as never,
    assetGrantQuery as never,
    employeeOnboardingRepository as never,
    overtimeRequestService as never,
    compOffCreditService as never,
    workforceCalendarService as never,
    workScheduleItemService as never,
    prisma as never,
  );

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
    contextService.resolve.mockResolvedValue({
      userId: 'user-1',
      employeeId: 'emp-1',
      employee: {
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
      },
      company: { id: 'co-1', companyName: 'Acme' },
      branch: { id: 'br-1', branchName: 'HQ', timezone: 'Asia/Kolkata' },
      department: { id: 'dept-1', departmentName: 'Engineering' },
      designation: { id: 'desig-1', designationName: 'Engineer' },
      timezone: 'Asia/Kolkata',
    });
  });

  it('creates leave requests with session employee id only', async () => {
    leaveRequestService.create.mockResolvedValue({ id: 'lr-1' });

    await service.createLeaveRequest(actor, {
      leaveTypeId: 'lt-1',
      fromDate: '2026-08-03',
      toDate: '2026-08-03',
    });

    expect(leaveRequestService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
      }),
    );
  });

  it('previews leave with the same calculation path as submit', async () => {
    leavePolicyResolver.resolveCalculation.mockResolvedValue({
      requestedWorkingDays: 1,
      fromCalendarDate: '2026-08-03',
      toCalendarDate: '2026-08-03',
      timezone: 'Asia/Kolkata',
      excludedHolidays: [],
      excludedNonWorkingDays: [],
      allowNegativeBalance: false,
    });
    employeeLeaveService.getProfile.mockResolvedValue({
      balances: [
        {
          leaveTypeId: 'lt-1',
          leaveName: 'Annual',
          entitlement: 12,
          used: 2,
          pending: 1,
          balance: 9,
        },
      ],
    });

    const preview = await service.previewLeaveRequest(actor, {
      leaveTypeId: 'lt-1',
      fromDate: '2026-08-03',
      toDate: '2026-08-03',
    });

    expect(leavePolicyResolver.resolveCalculation).toHaveBeenCalledWith(
      expect.objectContaining({
        employeeId: 'emp-1',
        leaveTypeId: 'lt-1',
      }),
    );
    expect(preview.requestedWorkingDays).toBe(1);
    expect(preview.canSubmit).toBe(true);
    expect(preview.balance?.afterSubmit).toEqual({
      available: 8,
      pending: 2,
      used: 2,
    });
  });

  it('blocks updating another employee leave request', async () => {
    leaveRequestService.findOne.mockResolvedValue({
      id: 'lr-2',
      employeeId: 'emp-other',
    });

    await expect(
      service.updateLeaveRequest(actor, 'lr-2', { reason: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('check-in does not accept an employee id from the client', async () => {
    attendanceService.checkIn.mockResolvedValue({ id: 'att-1' });
    await service.checkIn(actor);
    expect(attendanceService.checkIn).toHaveBeenCalledWith({}, actor);
  });

  it('loads workspace data only for the resolved employee', async () => {
    attendanceService.getTodayAttendance.mockResolvedValue(null);
    employeeLeaveService.getProfile.mockResolvedValue({
      summary: {
        totalEntitlement: 0,
        totalUsed: 0,
        totalPending: 0,
        totalBalance: 0,
      },
      balances: [],
      upcoming: [],
    });
    employeeOnboardingRepository.findActiveByEmployee.mockResolvedValue(null);
    employeeOnboardingRepository.findByEmployee.mockResolvedValue(null);
    employeeDocumentService.findByEmployee.mockResolvedValue([]);
    employeeDocumentService.employeeSummary.mockResolvedValue({
      total: 0,
      verified: 0,
      pending: 0,
      expired: 0,
    });
    assetSelfServiceQuery.findCurrentByEmployee.mockResolvedValue([]);
    prisma.shiftRosterEntry.findMany.mockResolvedValue([]);
    workScheduleItemService.getEmployeeTodayItems.mockResolvedValue([]);

    const workspace = await service.getWorkspace(actor);

    expect(attendanceService.getTodayAttendance).toHaveBeenCalledWith('emp-1');
    expect(employeeLeaveService.getProfile).toHaveBeenCalledWith(
      'emp-1',
      expect.any(Number),
    );
    expect(employeeDocumentService.findByEmployee).toHaveBeenCalledWith(
      'emp-1',
    );
    expect(assetSelfServiceQuery.findCurrentByEmployee).toHaveBeenCalledWith(
      'emp-1',
    );
    expect(workScheduleItemService.getEmployeeTodayItems).toHaveBeenCalledWith(
      'emp-1',
    );
    expect(workspace.todayShift).toBeNull();
    expect(workspace.punchReadiness?.canCheckIn).toBe(false);
    expect(workspace.punchReadiness?.setupHref).toBe('/my-workspace/calendar');
    expect(workspace.todayWorkPlan).toEqual({ itemCount: 0, items: [] });
  });

  it('does not calculate workspace dates in UTC when the branch timezone is missing', async () => {
    contextService.resolve.mockResolvedValue({
      userId: 'user-1',
      employeeId: 'emp-1',
      employee: {
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
      },
      company: { id: 'co-1', companyName: 'Acme' },
      branch: { id: 'br-1', branchName: 'HQ', timezone: null },
      department: { id: 'dept-1', departmentName: 'Engineering' },
      designation: { id: 'desig-1', designationName: 'Engineer' },
      timezone: null,
    });

    await expect(service.getWorkspace(actor)).rejects.toThrow(
      'BRANCH_TIMEZONE_REQUIRED',
    );
    expect(branchTime.requireTimezone).toHaveBeenCalledWith(null);
    expect(attendanceService.getTodayAttendance).not.toHaveBeenCalled();
  });

  it('blocks check-in when employee has approved full-day leave today', async () => {
    attendanceService.getTodayAttendance.mockResolvedValue(null);
    employeeLeaveService.getProfile.mockResolvedValue({
      summary: {
        totalEntitlement: 0,
        totalUsed: 0,
        totalPending: 0,
        totalBalance: 0,
      },
      balances: [],
      upcoming: [],
    });
    employeeOnboardingRepository.findActiveByEmployee.mockResolvedValue(null);
    employeeOnboardingRepository.findByEmployee.mockResolvedValue(null);
    employeeDocumentService.findByEmployee.mockResolvedValue([]);
    employeeDocumentService.employeeSummary.mockResolvedValue({
      total: 0,
      verified: 0,
      pending: 0,
      expired: 0,
    });
    assetSelfServiceQuery.findCurrentByEmployee.mockResolvedValue([]);
    prisma.shiftRosterEntry.findMany.mockResolvedValue([
      {
        workDate: new Date(),
        dayType: 'WORKING',
        shift: { shiftName: 'General' },
        scheduledStartAt: null,
        scheduledEndAt: null,
      },
    ]);
    workScheduleItemService.getEmployeeTodayItems.mockResolvedValue([]);
    prisma.leaveRequest.findFirst.mockResolvedValue({ id: 'lr-oh' });

    const workspace = await service.getWorkspace(actor);

    expect(workspace.punchReadiness?.canCheckIn).toBe(false);
    expect(workspace.punchReadiness?.checkInBlockedReason).toBe(
      'You are on approved leave today; check-in is not required.',
    );
  });
});
