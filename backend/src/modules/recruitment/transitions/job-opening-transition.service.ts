import { Injectable, NotFoundException } from '@nestjs/common';
import {
  JobOpening,
  JobOpeningStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';

import { DomainConflictException, getRequestActor } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { RECRUITMENT_ERROR_CODES } from '../core/recruitment-error-codes';
import { RecruitmentDomainScopeService } from '../core/recruitment-domain-scope.service';
import { isAllowedOpeningTransition } from '../core/recruitment.utils';

import {
  getJobOpeningAllowedActions,
  JobOpeningTransitionResult,
} from './recruitment-transition.types';

const TERMINAL_OPENING_STATUSES: JobOpeningStatus[] = ['CLOSED'];

@Injectable()
export class JobOpeningTransitionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: RecruitmentDomainScopeService,
    private readonly auditService: AuditService,
  ) {}

  async publish(
    jobOpeningId: string,
    expectedVersion?: number,
  ): Promise<JobOpeningTransitionResult> {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);
    this.assertExpectedVersion(opening, expectedVersion);
    this.assertTransition(opening.status, 'OPEN');

    const checklist = await this.buildPublicationChecklist(opening.id);
    const blockers = checklist.filter((item) => !item.passed);

    if (blockers.length > 0) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_NOT_PUBLISHABLE,
        'Job opening cannot be published',
      );
    }

    return this.transition(opening, 'OPEN', {
      publishedAt: new Date(),
    });
  }

  async hold(
    jobOpeningId: string,
    expectedVersion?: number,
  ): Promise<JobOpeningTransitionResult> {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);
    this.assertExpectedVersion(opening, expectedVersion);
    this.assertTransition(opening.status, 'ON_HOLD');

    return this.transition(opening, 'ON_HOLD');
  }

  async reopen(
    jobOpeningId: string,
    expectedVersion?: number,
  ): Promise<JobOpeningTransitionResult> {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);
    this.assertExpectedVersion(opening, expectedVersion);
    this.assertTransition(opening.status, 'OPEN');

    return this.transition(opening, 'OPEN');
  }

  async markFilled(
    jobOpeningId: string,
    expectedVersion?: number,
  ): Promise<JobOpeningTransitionResult> {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);
    this.assertExpectedVersion(opening, expectedVersion);
    this.assertTransition(opening.status, 'FILLED');

    if (opening.headcountFilled < opening.headcountTotal) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_NOT_PUBLISHABLE,
        'Opening headcount is not fully filled.',
      );
    }

    return this.transition(opening, 'FILLED');
  }

  async close(
    jobOpeningId: string,
    expectedVersion?: number,
  ): Promise<JobOpeningTransitionResult> {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);
    this.assertExpectedVersion(opening, expectedVersion);
    this.assertTransition(opening.status, 'CLOSED');

    return this.transition(opening, 'CLOSED');
  }

  async buildPublicationChecklist(jobOpeningId: string) {
    const opening = await this.scope.assertJobOpeningInScope(jobOpeningId);

    const [company, branch, department, designation, hiringManager, criteria] =
      await Promise.all([
        this.prisma.company.findUnique({ where: { id: opening.companyId } }),
        this.prisma.branch.findUnique({ where: { id: opening.branchId } }),
        this.prisma.department.findUnique({
          where: { id: opening.departmentId },
        }),
        this.prisma.designation.findUnique({
          where: { id: opening.designationId },
        }),
        this.prisma.employee.findUnique({
          where: { id: opening.hiringManagerEmployeeId },
        }),
        this.prisma.jobOpeningCriterion.findMany({
          where: {
            jobOpeningId: opening.id,
            isActive: true,
          },
        }),
      ]);

    const hiringManagerUser = hiringManager
      ? await this.prisma.user.findFirst({
          where: {
            employeeId: hiringManager.id,
            status: UserStatus.ACTIVE,
          },
        })
      : null;

    const criteriaTotal = criteria.reduce(
      (sum, criterion) => sum + Number(criterion.weightPercent),
      0,
    );

    return [
      {
        code: 'ORGANIZATION_ACTIVE',
        label: 'Organization hierarchy is active',
        passed:
          Boolean(company?.isActive) &&
          Boolean(branch?.isActive) &&
          Boolean(department?.isActive) &&
          Boolean(designation?.isActive),
      },
      {
        code: 'HIRING_MANAGER_LINKED',
        label: 'Hiring manager is active with a linked user',
        passed: Boolean(hiringManager?.isActive) && Boolean(hiringManagerUser),
      },
      {
        code: 'HEADCOUNT_VALID',
        label: 'Headcount is valid',
        passed: opening.headcountTotal >= 1,
      },
      {
        code: 'DEADLINE_VALID',
        label: 'Application deadline is valid',
        passed:
          !opening.applicationDeadline ||
          opening.applicationDeadline.getTime() > Date.now(),
      },
      {
        code: 'CRITERIA_TOTAL_100',
        label: 'Active criteria total exactly 100 percent',
        passed: criteria.length > 0 && Math.abs(criteriaTotal - 100) < 0.01,
      },
    ];
  }

  private assertExpectedVersion(
    opening: JobOpening,
    expectedVersion?: number,
  ): void {
    if (expectedVersion !== undefined && opening.version !== expectedVersion) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_STALE_VERSION,
        'Job opening was modified by another request',
      );
    }
  }

  private assertTransition(
    current: JobOpeningStatus,
    target: JobOpeningStatus,
  ): void {
    if (!isAllowedOpeningTransition(current, target)) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_INVALID_TRANSITION,
        `Cannot transition job opening from ${current} to ${target}`,
      );
    }
  }

  private async transition(
    opening: JobOpening,
    targetStatus: JobOpeningStatus,
    extra?: Prisma.JobOpeningUpdateInput,
  ): Promise<JobOpeningTransitionResult> {
    if (TERMINAL_OPENING_STATUSES.includes(opening.status)) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_TERMINAL,
        `Job opening in ${opening.status} cannot be transitioned`,
      );
    }

    const actor = getRequestActor();

    const updated = await this.prisma.jobOpening.update({
      where: {
        id: opening.id,
        version: opening.version,
      },
      data: {
        status: targetStatus,
        version: { increment: 1 },
        updatedByUserId: actor.userId,
        ...extra,
      },
    });

    await this.auditService.log(
      'JobOpening',
      opening.id,
      `STATUS_${targetStatus}`,
      { status: opening.status, version: opening.version },
      { status: updated.status, version: updated.version },
      { userId: actor.userId },
    );

    return {
      record: updated,
      version: updated.version,
      allowedActions: getJobOpeningAllowedActions(updated.status),
    };
  }

  validateCriteriaTotal(
    criteria: Array<{ weightPercent: number; isActive?: boolean }>,
  ): void {
    const activeCriteria = criteria.filter(
      (criterion) => criterion.isActive !== false,
    );
    const total = activeCriteria.reduce(
      (sum, criterion) => sum + Number(criterion.weightPercent),
      0,
    );

    if (activeCriteria.length === 0 || Math.abs(total - 100) >= 0.01) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.OPENING_CRITERIA_NOT_100,
        'Active criteria must total exactly 100 percent',
      );
    }
  }

  async assertHiringManagerValid(hiringManagerEmployeeId: string) {
    const manager = await this.prisma.employee.findFirst({
      where: {
        id: hiringManagerEmployeeId,
        isActive: true,
      },
    });

    if (!manager) {
      throw new NotFoundException('Hiring manager not found');
    }

    const user = await this.prisma.user.findFirst({
      where: {
        employeeId: manager.id,
        status: UserStatus.ACTIVE,
      },
    });

    if (!user) {
      throw new DomainConflictException(
        RECRUITMENT_ERROR_CODES.HIRING_MANAGER_INACTIVE,
        'Hiring manager must be linked to an active user',
      );
    }

    return manager;
  }
}
