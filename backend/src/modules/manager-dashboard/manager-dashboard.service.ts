import { Injectable } from '@nestjs/common';

import {
  calendarDateToUtcMidnight,
  toCalendarDate,
} from '../attendance/attendance-calendar.util';
import { BranchTimeService } from '../attendance/branch-time.service';
import { OrganizationScopeService } from '../auth';
import type { AuthenticatedUser } from '../auth';
import {
  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
  LeaveRequestStatus,
} from '../employee-leave/constants';
import { AttendanceStatus } from '../attendance/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface ManagerDashboardResponse {
  asOf: string;
  timezone: string;
  source: 'live';
  context: {
    scopeLevel: string;
    isGlobal: boolean;
    activeCompanyGroupId?: string;
    activeCompanyId?: string;
    activeBranchId?: string;
  };
  manager: {
    fullName: string;
    role: string;
  };
  visibility: {
    employeeSummary: boolean;
    attendance: boolean;
    leave: boolean;
    onboarding: boolean;
  };
  kpis: {
    totalActiveEmployees: number;
    presentToday: number;
    onLeaveToday: number;
    activeOnboardings: number;
  };
  pendingOnboardingTasks: Array<{
    id: string;
    title: string;
    assignee: string;
    status: string;
    dueDate: string | null;
  }>;
  pendingLeaveApprovals: Array<{
    id: string;
    employeeName: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    requestedDays: number;
    status: string;
  }>;
  attendanceOverview: Array<{
    label: string;
    status: string;
    count: number;
    percentage: number;
  }>;
  recentJoiners: Array<{
    id: string;
    name: string;
    designation: string;
    joiningDate: string | null;
  }>;
}

type PendingOnboardingTask = Prisma.EmployeeOnboardingTaskGetPayload<{
  include: {
    onboarding: {
      include: {
        employee: {
          select: { firstName: true; lastName: true };
        };
      };
    };
  };
}>;

type PendingLeaveApproval = Prisma.LeaveRequestGetPayload<{
  include: {
    employee: {
      select: { firstName: true; lastName: true };
    };
    leaveType: {
      select: { leaveName: true };
    };
  };
}>;

type RecentJoiner = Prisma.EmployeeGetPayload<{
  include: {
    designation: {
      select: { designationName: true };
    };
  };
}>;

@Injectable()
export class ManagerDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly branchTime: BranchTimeService,
  ) {}

  async getDashboard(
    actor: AuthenticatedUser,
  ): Promise<ManagerDashboardResponse> {
    const scope = this.organizationScope.current();
    const employeeScope = this.buildEmployeeScopeWhere();
    const asOf = new Date();
    const permissions = new Set(actor.authorization.permissions);
    const canReadEmployeeSummary = this.hasAnyPermission(permissions, [
      'hr.employees.read',
      'hr.employees.manage',
    ]);
    const canReadAttendance = this.hasAnyPermission(permissions, [
      'hr.attendance.read',
      'hr.attendance.manage',
    ]);
    const canReadLeave = this.hasAnyPermission(permissions, [
      'hr.leave.read',
      'hr.leave.manage',
      'hr.leave.approve',
      'hr.team.approve',
    ]);
    const canReadOnboarding = this.hasAnyPermission(permissions, [
      'hr.onboarding.read',
      'hr.onboarding.manage',
    ]);
    const canApproveLeave = this.hasAnyPermission(permissions, [
      'hr.leave.manage',
      'hr.leave.approve',
      'hr.team.approve',
    ]);

    const branches = await this.prisma.branch.findMany({
      where: this.buildBranchScopeWhere(),
      select: {
        id: true,
        timezone: true,
      },
    });

    const branchToday = branches.map((branch) => {
      const timezone = this.branchTime.requireTimezone(branch.timezone);
      const calendarDate = toCalendarDate(asOf, timezone);
      return {
        branchId: branch.id,
        timezone,
        calendarDate,
        attendanceDate: calendarDateToUtcMidnight(calendarDate),
      };
    });

    const uniqueTimezones = [
      ...new Set(branchToday.map((item) => item.timezone)),
    ];
    const timezone =
      scope.activeBranchId && branchToday.length === 1
        ? branchToday[0].timezone
        : uniqueTimezones.length <= 1
          ? (uniqueTimezones[0] ?? 'NOT_CONFIGURED')
          : 'MULTI';

    const todayAttendanceOr =
      branchToday.length === 0
        ? undefined
        : branchToday.map((item) => ({
            employee: {
              ...employeeScope,
              branchId: item.branchId,
            },
            attendanceDate: item.attendanceDate,
            isActive: true,
          }));

    const leaveTodayOr =
      branchToday.length === 0
        ? undefined
        : branchToday.map((item) => {
            const dayStart = item.attendanceDate;
            const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
            return {
              employee: {
                ...employeeScope,
                branchId: item.branchId,
              },
              status: LeaveRequestStatus.APPROVED,
              isActive: true,
              fromDate: { lt: dayEnd },
              toDate: { gte: dayStart },
            } satisfies Prisma.LeaveRequestWhereInput;
          });

    const emptyAttendanceGroups: Array<{
      status: string;
      _count: { _all: number };
    }> = [];

    const [
      totalActiveEmployees,
      presentToday,
      onLeaveToday,
      activeOnboardings,
      pendingOnboardingTasks,
      pendingLeaveApprovals,
      attendanceRows,
      recentJoiners,
    ] = await Promise.all([
      canReadEmployeeSummary
        ? this.prisma.employee.count({
            where: {
              ...employeeScope,
              isActive: true,
              employmentStatus: 'ACTIVE',
            },
          })
        : Promise.resolve(0),
      canReadAttendance && todayAttendanceOr
        ? this.prisma.attendance.count({
            where: {
              OR: todayAttendanceOr,
              status: {
                in: [AttendanceStatus.PRESENT, AttendanceStatus.HALF_DAY],
              },
            },
          })
        : Promise.resolve(0),
      canReadLeave && leaveTodayOr
        ? this.prisma.leaveRequest.count({
            where: { OR: leaveTodayOr },
          })
        : Promise.resolve(0),
      canReadOnboarding
        ? this.prisma.employeeOnboarding.count({
            where: {
              status: 'IN_PROGRESS',
              employee: employeeScope,
            },
          })
        : Promise.resolve(0),
      canReadOnboarding
        ? this.prisma.employeeOnboardingTask.findMany({
            where: {
              status: {
                in: ['PENDING', 'NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'],
              },
              onboarding: {
                status: 'IN_PROGRESS',
                employee: employeeScope,
              },
            },
            include: {
              onboarding: {
                include: {
                  employee: {
                    select: {
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ dueDate: 'asc' }, { sequenceNo: 'asc' }],
            take: 10,
          })
        : Promise.resolve([]),
      canApproveLeave
        ? this.prisma.leaveRequest.findMany({
            where: {
              isActive: true,
              status: {
                in: [
                  LeaveRequestStatus.SUBMITTED,
                  LEAVE_REQUEST_LEGACY_SUBMITTED_STATUS,
                ],
              },
              employee: employeeScope,
            },
            include: {
              employee: {
                select: { firstName: true, lastName: true },
              },
              leaveType: {
                select: { leaveName: true },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 10,
          })
        : Promise.resolve([]),
      canReadAttendance && todayAttendanceOr
        ? this.prisma.attendance.groupBy({
            by: ['status'],
            where: { OR: todayAttendanceOr },
            _count: { _all: true },
          })
        : Promise.resolve(emptyAttendanceGroups),
      canReadEmployeeSummary
        ? this.prisma.employee.findMany({
            where: {
              ...employeeScope,
              isActive: true,
              joiningDate: { not: null },
            },
            include: {
              designation: {
                select: { designationName: true },
              },
            },
            orderBy: { joiningDate: 'desc' },
            take: 8,
          })
        : Promise.resolve([]),
    ]);

    const attendanceTotal = attendanceRows.reduce(
      (sum, row) => sum + row._count._all,
      0,
    );
    const overviewOrder = [
      AttendanceStatus.PRESENT,
      AttendanceStatus.ABSENT,
      AttendanceStatus.LEAVE,
      AttendanceStatus.HALF_DAY,
    ] as const;
    const countByStatus = new Map<string, number>(
      attendanceRows.map((row) => [row.status, row._count._all]),
    );

    const attendanceOverview = canReadAttendance
      ? overviewOrder.map((status) => {
          const count = countByStatus.get(status) ?? 0;
          return {
            label: status.replace(/_/g, ' '),
            status,
            count,
            percentage:
              attendanceTotal === 0
                ? 0
                : Math.round((count / attendanceTotal) * 100),
          };
        })
      : [];

    const onboardingTaskRows =
      pendingOnboardingTasks as PendingOnboardingTask[];
    const leaveApprovalRows = pendingLeaveApprovals as PendingLeaveApproval[];
    const recentJoinerRows = recentJoiners as RecentJoiner[];

    return {
      asOf: asOf.toISOString(),
      timezone,
      source: 'live',
      context: {
        scopeLevel: scope.scopeLevel ?? 'GLOBAL',
        isGlobal: Boolean(scope.isGlobal),
        activeCompanyGroupId: scope.activeCompanyGroupId,
        activeCompanyId: scope.activeCompanyId,
        activeBranchId: scope.activeBranchId,
      },
      manager: {
        fullName: actor.displayName || actor.username,
        role: actor.authorization.roles[0] ?? 'Manager',
      },
      visibility: {
        employeeSummary: canReadEmployeeSummary,
        attendance: canReadAttendance,
        leave: canReadLeave,
        onboarding: canReadOnboarding,
      },
      kpis: {
        totalActiveEmployees,
        presentToday,
        onLeaveToday,
        activeOnboardings,
      },
      pendingOnboardingTasks: onboardingTaskRows.map((task) => ({
        id: task.id,
        title: task.taskName,
        assignee: [
          task.onboarding.employee.firstName,
          task.onboarding.employee.lastName,
        ]
          .filter(Boolean)
          .join(' '),
        status: task.status,
        dueDate: task.dueDate?.toISOString() ?? null,
      })),
      pendingLeaveApprovals: leaveApprovalRows.map((request) => ({
        id: request.id,
        employeeName: [request.employee.firstName, request.employee.lastName]
          .filter(Boolean)
          .join(' '),
        leaveType: request.leaveType.leaveName,
        fromDate: request.fromDate.toISOString(),
        toDate: request.toDate.toISOString(),
        requestedDays: Number(request.requestedDays),
        status: request.status,
      })),
      attendanceOverview,
      recentJoiners: recentJoinerRows.map((employee) => ({
        id: employee.id,
        name: [employee.firstName, employee.lastName].filter(Boolean).join(' '),
        designation: employee.designation?.designationName ?? '',
        joiningDate: employee.joiningDate?.toISOString() ?? null,
      })),
    };
  }

  private buildEmployeeScopeWhere(): Prisma.EmployeeWhereInput {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();
    const companyId = this.organizationScope.companyIdOrUndefined();
    const branchId = this.organizationScope.branchIdOrUndefined();

    return {
      ...(branchId ? { branchId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(!companyId && companyGroupId ? { company: { companyGroupId } } : {}),
    };
  }

  private hasAnyPermission(
    permissions: ReadonlySet<string>,
    required: readonly string[],
  ): boolean {
    return required.some((permission) => permissions.has(permission));
  }

  private buildBranchScopeWhere(): Prisma.BranchWhereInput {
    const companyGroupId = this.organizationScope.companyGroupIdOrUndefined();
    const companyId = this.organizationScope.companyIdOrUndefined();
    const branchId = this.organizationScope.branchIdOrUndefined();

    return {
      isActive: true,
      ...(branchId ? { id: branchId } : {}),
      ...(companyId ? { companyId } : {}),
      ...(!companyId && companyGroupId ? { company: { companyGroupId } } : {}),
    };
  }
}
