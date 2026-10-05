import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessCalendarRuntimeMode,
  BusinessCalendarScope,
  BusinessDayStatus,
  DayPortion,
} from '@prisma/client';

import { WorkforceTimeErrorCode } from '../../common/constants/workforce-time-error-codes';
import { LeaveRequestStatus } from '../employee-leave/constants';
import { WorkforceCalendarService } from './workforce-calendar.service';

describe('WorkforceCalendarService date range', () => {
  const service = new WorkforceCalendarService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('rejects inverted ranges', () => {
    expect(() =>
      (
        service as unknown as {
          assertDateRange: (a: string, b: string) => unknown;
        }
      ).assertDateRange('2026-08-10', '2026-08-01'),
    ).toThrow(BadRequestException);
  });

  it('rejects ranges longer than 62 days', () => {
    try {
      (
        service as unknown as {
          assertDateRange: (a: string, b: string) => unknown;
        }
      ).assertDateRange('2026-01-01', '2026-03-15');
      fail('expected ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toMatchObject({
        code: WorkforceTimeErrorCode.ROSTER_PERIOD_TOO_LONG,
      });
    }
  });

  it('expands inclusive day list for a short range', () => {
    const result = (
      service as unknown as {
        assertDateRange: (
          a: string,
          b: string,
        ) => { dates: string[]; fromDate: Date; toDate: Date };
      }
    ).assertDateRange('2026-08-01', '2026-08-03');
    expect(result.dates).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });
});

describe('WorkforceCalendarService employee options', () => {
  const prisma = {
    employee: {
      findMany: jest.fn(),
    },
  };
  const employeeDomainScope = {
    employeeWhere: jest.fn().mockReturnValue({ companyId: 'co-1' }),
    assertBranchInScope: jest.fn(),
    assertDepartmentInScope: jest.fn(),
  };
  const reportingTeamScope = {
    resolveVisibility: jest.fn(),
  };
  const service = new WorkforceCalendarService(
    prisma as never,
    employeeDomainScope as never,
    reportingTeamScope as never,
    {} as never,
  );
  const actor = {
    id: 'user-1',
    username: 'mgr',
    mustChangePassword: false,
    sessionId: 's1',
    employeeId: 'mgr-emp',
    authorization: {
      roles: [],
      permissions: ['hr.team.read'],
      scopeLevel: 'COMPANY' as const,
      isGlobal: false,
      activeCompanyId: 'co-1',
      availableScopes: [],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    employeeDomainScope.employeeWhere.mockReturnValue({ companyId: 'co-1' });
    employeeDomainScope.assertBranchInScope.mockResolvedValue({ id: 'b1' });
    employeeDomainScope.assertDepartmentInScope.mockResolvedValue({ id: 'd1' });
  });

  it('lists only the manager and reportees and marks self', async () => {
    reportingTeamScope.resolveVisibility.mockResolvedValue({
      mode: 'TEAM',
      employeeIds: ['mgr-emp', 'rep-1'],
      canViewOperationalDetail: true,
      canViewSensitiveFields: false,
    });
    prisma.employee.findMany.mockResolvedValue([
      {
        id: 'mgr-emp',
        employeeCode: 'E1',
        firstName: 'Pat',
        lastName: 'Mgr',
        branchId: 'b1',
        departmentId: 'd1',
      },
      {
        id: 'rep-1',
        employeeCode: 'E2',
        firstName: 'Sam',
        lastName: 'Rep',
        branchId: 'b1',
        departmentId: 'd1',
      },
    ]);

    const result = await service.listEmployeeOptions(actor, {});

    expect(result.accessMode).toBe('TEAM');
    expect(result.items.map((row) => row.id)).toEqual(['mgr-emp', 'rep-1']);
    expect(result.items[0]?.isSelf).toBe(true);
    expect(result.items[1]?.isSelf).toBe(false);
    const listCalls = prisma.employee.findMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    const listCall = listCalls[0]?.[0];
    expect(listCall?.where).toMatchObject({
      id: { in: ['mgr-emp', 'rep-1'] },
      companyId: 'co-1',
    });
  });

  it('404s a foreign branch instead of widening the list', async () => {
    reportingTeamScope.resolveVisibility.mockResolvedValue({
      mode: 'TENANT',
      employeeIds: null,
      canViewOperationalDetail: true,
      canViewSensitiveFields: false,
    });
    employeeDomainScope.assertBranchInScope.mockRejectedValue(
      new NotFoundException('Branch not found'),
    );

    await expect(
      service.listEmployeeOptions(actor, { branchId: 'foreign-branch' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.employee.findMany).not.toHaveBeenCalled();
  });

  it('passes branch and department as narrowing filters only', async () => {
    reportingTeamScope.resolveVisibility.mockResolvedValue({
      mode: 'TENANT',
      employeeIds: null,
      canViewOperationalDetail: true,
      canViewSensitiveFields: false,
    });
    prisma.employee.findMany.mockResolvedValue([]);

    await service.listEmployeeOptions(actor, {
      branchId: 'b1',
      departmentId: 'd1',
    });

    expect(employeeDomainScope.assertBranchInScope).toHaveBeenCalledWith('b1');
    expect(employeeDomainScope.assertDepartmentInScope).toHaveBeenCalledWith(
      'd1',
      undefined,
      'b1',
    );
    const listCalls = prisma.employee.findMany.mock.calls as unknown as Array<
      [{ where: Record<string, unknown> }]
    >;
    const listCall = listCalls[0]?.[0];
    expect(listCall?.where).toMatchObject({
      branchId: 'b1',
      departmentId: 'd1',
    });
  });
});

describe('WorkforceCalendarService assembleDay privacy', () => {
  const service = new WorkforceCalendarService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  function assemble(visibilityMode: 'TEAM' | 'TENANT') {
    return (
      service as unknown as {
        assembleDay: (params: Record<string, unknown>) => {
          employees: Array<Record<string, unknown>>;
        };
      }
    ).assembleDay({
      date: '2026-08-11',
      actorEmployeeId: 'mgr-emp',
      visibility: {
        mode: visibilityMode,
        employeeIds: ['mgr-emp', 'rep-1'],
        canViewOperationalDetail: true,
        canViewSensitiveFields: false,
      },
      employees: [
        {
          id: 'rep-1',
          employeeCode: 'E2',
          firstName: 'Sam',
          lastName: 'Rep',
          companyId: 'co-1',
          branchId: 'b1',
          departmentId: 'd1',
        },
      ],
      rosterEntries: [],
      holidays: [
        {
          holidayDate: new Date('2026-08-11T00:00:00.000Z'),
          companyId: 'co-1',
          branchId: 'b1',
          dayPortion: 'FULL_DAY',
          holidayName: 'Independence Day',
          source: 'BUSINESS_CALENDAR',
          calendarId: 'cal-1',
        },
      ],
      leaveRequests: [
        {
          employeeId: 'rep-1',
          fromDate: new Date('2026-08-11T00:00:00.000Z'),
          toDate: new Date('2026-08-11T00:00:00.000Z'),
          status: LeaveRequestStatus.SUBMITTED,
          isHalfDay: true,
          leaveType: { id: 'lt-casual', leaveName: 'Casual Leave' },
          approvalTransaction: {
            currentStep: 1,
            status: 'PENDING',
            workflow: {
              steps: [
                {
                  stepNo: 1,
                  approverType: 'REPORTING_MANAGER',
                  approverRole: null,
                },
                {
                  stepNo: 2,
                  approverType: 'ROLE',
                  approverRole: 'HR_MANAGER',
                },
              ],
            },
            approvalSteps: [
              {
                stepNo: 1,
                status: 'PENDING',
                approverId: 'mgr-emp',
                actionDate: null,
              },
              {
                stepNo: 2,
                status: 'PENDING',
                approverId: 'emp-hr',
                actionDate: null,
              },
            ],
          },
        },
      ],
      attendances: [],
      overtime: [],
    });
  }

  it('shows leave type, portion, holiday and stage to a manager without reason', () => {
    const [entry] = assemble('TEAM').employees;
    expect(entry.leaveTypeName).toBe('Casual Leave');
    expect(entry.leaveTypeId).toBe('lt-casual');
    expect(entry.leaveStatus).toBe(LeaveRequestStatus.SUBMITTED);
    expect(entry.dayPortion).toBe('HALF_DAY');
    expect(entry.holidayName).toBe('Independence Day');
    expect(entry.holidaySource).toBe('BUSINESS_CALENDAR');
    expect(entry.holidayCalendarId).toBe('cal-1');
    expect(entry.approvalStage).toBe('MANAGER_REVIEW');
    expect(entry).not.toHaveProperty('reason');
    expect(entry).not.toHaveProperty('attachments');
    expect(entry.overtimeStatus).toBeUndefined();
  });
});

describe('WorkforceCalendarService optional holiday leave privacy', () => {
  const service = new WorkforceCalendarService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  it('maps approved optional leave without approval transaction to ON_LEAVE for selector only', () => {
    const day = (
      service as unknown as {
        assembleDay: (params: Record<string, unknown>) => {
          employees: Array<Record<string, unknown>>;
        };
      }
    ).assembleDay({
      date: '2027-02-01',
      actorEmployeeId: 'mgr-emp',
      visibility: {
        mode: 'TEAM',
        employeeIds: ['emp-a', 'emp-b'],
        canViewOperationalDetail: true,
        canViewSensitiveFields: false,
      },
      employees: [
        {
          id: 'emp-a',
          employeeCode: 'E1',
          firstName: 'Ada',
          lastName: 'Selector',
          companyId: 'co-1',
          branchId: 'b1',
          departmentId: 'd1',
        },
        {
          id: 'emp-b',
          employeeCode: 'E2',
          firstName: 'Bob',
          lastName: 'Worker',
          companyId: 'co-1',
          branchId: 'b1',
          departmentId: 'd1',
        },
      ],
      rosterEntries: [
        {
          employeeId: 'emp-a',
          workDate: new Date('2027-02-01T00:00:00.000Z'),
          dayType: 'WORKING',
          dayPortion: 'FULL_DAY',
          shift: { id: 'sh-1', shiftName: 'General' },
          scheduledStartAt: null,
          scheduledEndAt: null,
        },
        {
          employeeId: 'emp-b',
          workDate: new Date('2027-02-01T00:00:00.000Z'),
          dayType: 'WORKING',
          dayPortion: 'FULL_DAY',
          shift: { id: 'sh-1', shiftName: 'General' },
          scheduledStartAt: null,
          scheduledEndAt: null,
        },
      ],
      holidays: [],
      leaveRequests: [
        {
          employeeId: 'emp-a',
          fromDate: new Date('2027-02-01T00:00:00.000Z'),
          toDate: new Date('2027-02-01T00:00:00.000Z'),
          status: LeaveRequestStatus.APPROVED,
          isHalfDay: false,
          leaveType: { id: 'lt-oh', leaveName: 'Optional Holiday' },
          approvalTransaction: null,
        },
      ],
      attendances: [],
      overtime: [],
    });

    const selector = day.employees.find((row) => row.employeeId === 'emp-a');
    const colleague = day.employees.find((row) => row.employeeId === 'emp-b');

    expect(selector?.state).toBe('ON_LEAVE');
    expect(selector?.leaveTypeName).toBe('Optional Holiday');
    expect(selector?.leaveStatus).toBe(LeaveRequestStatus.APPROVED);
    expect(selector?.approvalStage).toBe('APPROVED');
    expect(colleague?.state).toBe('SCHEDULED');
    expect(colleague?.leaveStatus).toBeNull();
  });
});

describe('WorkforceCalendarService loadHolidayProjections', () => {
  const prisma = {
    branch: { findMany: jest.fn() },
    businessCalendar: { findMany: jest.fn() },
    businessCalendarRuntimeDay: { findMany: jest.fn() },
    businessCalendarEvent: { findMany: jest.fn() },
    holiday: { findMany: jest.fn() },
  };
  const calendarConsumer = {
    resolveConsumerDays: jest.fn(),
  };
  const service = new WorkforceCalendarService(
    prisma as never,
    {} as never,
    {} as never,
    calendarConsumer as never,
  );

  const fromDate = new Date('2026-08-11T00:00:00.000Z');
  const toDate = new Date('2026-08-11T00:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-1', companyId: 'co-1' },
    ]);
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-1',
        companyId: 'co-1',
        branchId: 'br-1',
        scope: BusinessCalendarScope.BRANCH,
        scopeKey: 'co-1:br-1',
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
      },
    ]);
    prisma.holiday.findMany.mockResolvedValue([]);
    calendarConsumer.resolveConsumerDays.mockResolvedValue(new Map());
  });

  async function loadProjections() {
    return (
      service as unknown as {
        loadHolidayProjections: (input: Record<string, unknown>) => Promise<
          Array<{
            holidayName: string | null;
            dayPortion: DayPortion;
          }>
        >;
      }
    ).loadHolidayProjections({
      companyIds: ['co-1'],
      branchIds: ['br-1'],
      fromDate,
      toDate,
      fromKey: '2026-08-11',
      toKey: '2026-08-11',
    });
  }

  it('projects non-working holidays from runtime rows', async () => {
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([
      {
        officeScopeKey: 'co-1:br-1',
        businessDate: fromDate,
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'EVENT',
        reasonText: 'Independence Day',
      },
    ]);

    const rows = await loadProjections();

    expect(rows).toHaveLength(1);
    expect(rows[0]?.holidayName).toBe('Independence Day');
    expect(calendarConsumer.resolveConsumerDays).not.toHaveBeenCalled();
    expect(prisma.businessCalendarEvent.findMany).not.toHaveBeenCalled();
  });

  it('does not project working-day overrides as holidays', async () => {
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([
      {
        officeScopeKey: 'co-1:br-1',
        businessDate: fromDate,
        dayStatus: BusinessDayStatus.WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'WORKING_DAY_OVERRIDE',
        reasonText: 'Open for business',
      },
    ]);

    const rows = await loadProjections();

    expect(rows).toHaveLength(0);
    expect(calendarConsumer.resolveConsumerDays).not.toHaveBeenCalled();
    expect(prisma.businessCalendarEvent.findMany).not.toHaveBeenCalled();
  });

  it('preview-fills holidays when ACTIVE runtime coverage is incomplete', async () => {
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([]);
    calendarConsumer.resolveConsumerDays.mockResolvedValue(
      new Map([
        [
          '2026-08-11',
          {
            date: '2026-08-11',
            dayStatus: BusinessDayStatus.NON_WORKING,
            dayPortion: DayPortion.FULL_DAY,
            kind: 'HOLIDAY',
            reasonCode: 'EVENT',
            reasonText: 'Preview Holiday',
            runtimeDayId: null,
            controllingEventId: null,
          },
        ],
      ]),
    );

    const rows = await loadProjections();

    expect(calendarConsumer.resolveConsumerDays).toHaveBeenCalledWith({
      companyId: 'co-1',
      branchId: 'br-1',
      from: '2026-08-11',
      to: '2026-08-11',
      materialize: false,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        holidayName: 'Preview Holiday',
        dayPortion: DayPortion.FULL_DAY,
      }),
    ]);
  });

  it('projects company-wide legacy holidays onto legacy branches in mixed companies', async () => {
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-active', companyId: 'co-1' },
      { id: 'br-legacy', companyId: 'co-1' },
    ]);
    prisma.businessCalendar.findMany.mockResolvedValue([
      {
        id: 'cal-active',
        companyId: 'co-1',
        branchId: 'br-active',
        scope: BusinessCalendarScope.BRANCH,
        scopeKey: 'co-1:br-active',
        runtimeMode: BusinessCalendarRuntimeMode.ACTIVE,
      },
    ]);
    prisma.businessCalendarRuntimeDay.findMany.mockResolvedValue([
      {
        officeScopeKey: 'co-1:br-active',
        businessDate: fromDate,
        dayStatus: BusinessDayStatus.NON_WORKING,
        dayPortion: DayPortion.FULL_DAY,
        reasonCode: 'EVENT',
        reasonText: 'Business Calendar Holiday',
      },
    ]);
    prisma.holiday.findMany.mockResolvedValue([
      {
        holidayDate: fromDate,
        companyId: 'co-1',
        branchId: null,
        dayPortion: DayPortion.FULL_DAY,
        holidayName: 'Republic Day',
      },
    ]);

    const rows = await (
      service as unknown as {
        loadHolidayProjections: (input: Record<string, unknown>) => Promise<
          Array<{
            branchId: string | null;
            holidayName: string | null;
            source: string;
          }>
        >;
      }
    ).loadHolidayProjections({
      companyIds: ['co-1'],
      branchIds: ['br-active', 'br-legacy'],
      fromDate,
      toDate,
      fromKey: '2026-08-11',
      toKey: '2026-08-11',
    });

    expect(prisma.holiday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            {
              companyId: { in: ['co-1'] },
              branchId: null,
            },
          ]) as unknown[],
        }) as object,
      }),
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          branchId: 'br-active',
          holidayName: 'Business Calendar Holiday',
          source: 'BUSINESS_CALENDAR',
        }),
        expect.objectContaining({
          branchId: 'br-legacy',
          holidayName: 'Republic Day',
          source: 'LEGACY_HOLIDAYS',
        }),
      ]),
    );
    expect(
      rows.filter((row) => row.holidayName === 'Republic Day'),
    ).toHaveLength(1);
    expect(calendarConsumer.resolveConsumerDays).not.toHaveBeenCalled();
  });
});
