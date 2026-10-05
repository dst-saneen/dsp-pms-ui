import { ForbiddenException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth';
import { EmployeeDomainScopeService } from '../auth';

export type CalendarAccessMode = 'SELF' | 'TEAM' | 'TENANT' | 'GLOBAL';

export interface CalendarVisibility {
  mode: CalendarAccessMode;
  /** Null means all employees within tenant domain scope. */
  employeeIds: string[] | null;
  canViewOperationalDetail: boolean;
  canViewSensitiveFields: boolean;
}

@Injectable()
export class ReportingTeamScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  /**
   * Resolves which employees the actor may see on calendar/team surfaces.
   * - HR / calendar.read with tenant scope → TENANT
   * - Project Manager with team.read → reporting team (direct reports)
   * - Otherwise → SELF only
   */
  async resolveVisibility(
    actor: AuthenticatedUser,
  ): Promise<CalendarVisibility> {
    const permissions = new Set(actor.authorization.permissions ?? []);
    const isGlobal = actor.authorization.isGlobal;

    const hasHrCalendar =
      isGlobal ||
      permissions.has('hr.calendar.read') ||
      permissions.has('hr.attendance.manage') ||
      permissions.has('hr.schedule.read') ||
      permissions.has('hr.schedule.manage');

    if (hasHrCalendar) {
      return {
        mode: isGlobal ? 'GLOBAL' : 'TENANT',
        employeeIds: null,
        canViewOperationalDetail: true,
        canViewSensitiveFields: false,
      };
    }

    if (permissions.has('hr.team.read') || permissions.has('hr.team.approve')) {
      if (!actor.employeeId) {
        throw new ForbiddenException(
          'Team calendar requires a linked employee',
        );
      }
      const reports = await this.findReportingEmployeeIds(actor.employeeId);
      return {
        mode: 'TEAM',
        employeeIds: [...new Set([actor.employeeId, ...reports])],
        canViewOperationalDetail: true,
        canViewSensitiveFields: false,
      };
    }

    if (!actor.employeeId) {
      throw new ForbiddenException('Self calendar requires a linked employee');
    }

    return {
      mode: 'SELF',
      employeeIds: [actor.employeeId],
      canViewOperationalDetail: true,
      canViewSensitiveFields: true,
    };
  }

  async assertEmployeeVisible(
    actor: AuthenticatedUser,
    employeeId: string,
  ): Promise<void> {
    const visibility = await this.resolveVisibility(actor);
    if (visibility.employeeIds === null) {
      await this.employeeDomainScope.assertEmployeeInScope(employeeId);
      return;
    }
    if (!visibility.employeeIds.includes(employeeId)) {
      this.employeeDomainScope.notFound('Employee');
    }
    await this.employeeDomainScope.assertEmployeeInScope(employeeId);
  }

  async findReportingEmployeeIds(managerEmployeeId: string): Promise<string[]> {
    const direct = await this.prisma.employee.findMany({
      where: {
        managerId: managerEmployeeId,
        isActive: true,
        ...this.employeeDomainScope.employeeWhere(),
      },
      select: { id: true },
    });
    return direct.map((row) => row.id);
  }
}
