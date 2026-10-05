import { Injectable } from '@nestjs/common';
import type { WorkLogHeader, WorkLogLine, WorkLogStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import { computeWorkLogAllowedActions } from '../policies/work-log-allowed-actions';
import { toDateOnlyIso } from '../policies/work-log-week';
import type {
  ProjectsActorContext,
  TimesheetLineView,
  TimesheetView,
} from '../types/project.types';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';

const timesheetInclude = {
  lines: { orderBy: { workDate: 'asc' as const } },
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeCode: true,
    },
  },
} satisfies Prisma.WorkLogHeaderInclude;

type HeaderWithLines = WorkLogHeader & {
  lines: WorkLogLine[];
  employee?: {
    firstName: string;
    lastName: string | null;
    employeeCode: string;
  } | null;
};

@Injectable()
export class ProjectTimesheetQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: ProjectsFeatureGateService,
  ) {}

  /** Shared Prisma include for timesheet views (lines + employee name). */
  static readonly headerInclude = timesheetInclude;

  async listMine(
    actor: ProjectsActorContext,
    query: { status?: string; page?: number; limit?: number },
  ) {
    const employeeId = this.requireActorEmployee(actor);
    await this.gate.assertEnabledForContext(actor.companyId);

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const where: Prisma.WorkLogHeaderWhereInput = {
      employeeId,
      ...(actor.companyId ? { companyId: actor.companyId } : {}),
      ...(query.status ? { statusV2: query.status as WorkLogStatus } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.workLogHeader.count({ where }),
      this.prisma.workLogHeader.findMany({
        where,
        include: timesheetInclude,
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toView(row, actor)),
      total,
      page,
      limit,
    };
  }

  async getMine(
    id: string,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    const employeeId = this.requireActorEmployee(actor);
    await this.gate.assertEnabledForContext(actor.companyId);
    const header = await this.prisma.workLogHeader.findFirst({
      where: {
        id,
        employeeId,
        ...(actor.companyId ? { companyId: actor.companyId } : {}),
      },
      include: timesheetInclude,
    });
    if (!header) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    return this.toView(header, actor);
  }

  async listTeam(
    actor: ProjectsActorContext,
    query: { status?: string; page?: number; limit?: number },
  ) {
    await this.gate.assertEnabledForContext(actor.companyId);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));

    const where: Prisma.WorkLogHeaderWhereInput = {
      reportingManagerUserId: actor.userId,
      statusV2: (query.status as WorkLogStatus) ?? 'SUBMITTED',
      ...(actor.companyId ? { companyId: actor.companyId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.workLogHeader.count({ where }),
      this.prisma.workLogHeader.findMany({
        where,
        include: timesheetInclude,
        orderBy: { periodStart: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toView(row, actor)),
      total,
      page,
      limit,
    };
  }

  async getTeam(
    id: string,
    actor: ProjectsActorContext,
  ): Promise<TimesheetView> {
    await this.gate.assertEnabledForContext(actor.companyId);
    const header = await this.prisma.workLogHeader.findFirst({
      where: {
        id,
        reportingManagerUserId: actor.userId,
        ...(actor.companyId ? { companyId: actor.companyId } : {}),
      },
      include: timesheetInclude,
    });
    if (!header) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_FOUND,
        'Timesheet not found',
      );
    }
    return this.toView(header, actor);
  }

  toView(header: HeaderWithLines, actor: ProjectsActorContext): TimesheetView {
    const status = header.statusV2 ?? 'DRAFT';
    const periodStart = header.periodStart ?? header.startDate;
    const periodEnd = header.periodEnd ?? header.endDate;
    const displayName = header.employee
      ? [header.employee.firstName, header.employee.lastName]
          .filter(Boolean)
          .join(' ')
      : null;
    return {
      id: header.id,
      version: header.version,
      companyId: header.companyId,
      branchId: header.branchId,
      employeeId: header.employeeId,
      displayName: displayName || null,
      employeeCode: header.employee?.employeeCode ?? null,
      periodStart: toDateOnlyIso(periodStart),
      periodEnd: toDateOnlyIso(periodEnd),
      totalHours: header.totalHours.toString(),
      status,
      remarks: header.remarks,
      reportingManagerEmployeeId: header.reportingManagerEmployeeId,
      reportingManagerUserId: header.reportingManagerUserId,
      lines: header.lines.map((line) => this.toLineView(line)),
      allowedActions: computeWorkLogAllowedActions({
        status,
        employeeId: header.employeeId,
        reportingManagerUserId: header.reportingManagerUserId,
        submittedByUserId: header.submittedByUserId,
        actor,
      }),
      actionRequirements: { expectedVersion: header.version },
    };
  }

  toLineView(line: WorkLogLine): TimesheetLineView {
    return {
      id: line.id,
      version: line.version,
      workDate: toDateOnlyIso(line.workDate),
      hours: line.hours.toString(),
      taskId: line.taskId,
      workCategoryId: line.workCategoryId,
      sourceType: line.sourceType,
      remarks: line.remarks,
    };
  }

  requireActorEmployee(actor: ProjectsActorContext): string {
    if (!actor.employeeId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.TIMESHEET_NOT_ASSIGNED_TO_ACTOR,
        'Authenticated employee context is required for timesheets.',
      );
    }
    return actor.employeeId;
  }
}
