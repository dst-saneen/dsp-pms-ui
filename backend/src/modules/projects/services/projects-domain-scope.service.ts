import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getOrganizationScope,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type { ProjectsActorContext } from '../types/project.types';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';

type OrgScope = ReturnType<typeof getOrganizationScope>;

@Injectable()
export class ProjectsDomainScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gate: ProjectsFeatureGateService,
  ) {}

  current(): OrgScope {
    return getOrganizationScope();
  }

  /**
   * Every Project operation resolves exactly one active Company.
   * Client body/query cannot override the organization scope Company.
   */
  requireCompanyId(explicitCompanyId?: string): string {
    void explicitCompanyId;
    // Ignore client-supplied company IDs — only the active organization scope counts.
    return this.gate.requireActiveCompanyId();
  }

  projectWhere(): Prisma.ProjectWhereInput {
    const scope = this.current();
    const companyId = this.requireCompanyId();

    if (scope.scopeLevel === 'BRANCH' && scope.activeBranchId) {
      return {
        companyId,
        OR: [{ branchId: scope.activeBranchId }, { branchId: null }],
      };
    }

    return { companyId };
  }

  async requireProject(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        ...this.projectWhere(),
      },
    });

    if (!project) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project not found',
      );
    }

    return project;
  }

  async requireProjectInTx(
    tx: Prisma.TransactionClient,
    projectId: string,
    companyId: string,
  ) {
    const scopedCompanyId = this.requireCompanyId();
    if (companyId !== scopedCompanyId) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project not found',
      );
    }

    const project = await tx.project.findFirst({
      where: {
        id: projectId,
        companyId: scopedCompanyId,
      },
    });

    if (!project) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project not found',
      );
    }

    return project;
  }

  /** Serializes Project lifecycle and child mutations on the parent row. */
  async lockProjectInTx(
    tx: Prisma.TransactionClient,
    projectId: string,
    companyId: string,
  ) {
    const scopedCompanyId = this.requireCompanyId();
    if (companyId !== scopedCompanyId) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project not found',
      );
    }
    const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT id
      FROM "projects"
      WHERE id = ${projectId} AND "companyId" = ${scopedCompanyId}
      FOR UPDATE
    `);
    if (rows.length !== 1) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project not found',
      );
    }
    return this.requireProjectInTx(tx, projectId, scopedCompanyId);
  }

  /** Draft configuration is administrative; active configuration is PM-owned. */
  assertConfigurationAuthority(
    project: {
      statusV2: ProjectStatus | null;
      archivedAt: Date | null;
      projectManagerId: string | null;
    },
    actor: ProjectsActorContext,
  ): void {
    const status = project.statusV2 ?? ProjectStatus.DRAFT;
    if (project.archivedAt) {
      this.parentStateBlocked('Archived Projects cannot be changed.');
    }
    if (status === ProjectStatus.DRAFT) {
      return;
    }
    if (status !== ProjectStatus.ACTIVE) {
      this.parentStateBlocked(
        `Project child records cannot be changed while the Project is ${status}.`,
      );
    }
    this.assertProjectManager(project, actor);
  }

  assertActiveWorkAuthority(
    project: {
      statusV2: ProjectStatus | null;
      archivedAt: Date | null;
      projectManagerId: string | null;
    },
    actor: ProjectsActorContext,
    managerRequired: boolean,
  ): void {
    const status = project.statusV2 ?? ProjectStatus.DRAFT;
    if (project.archivedAt || status !== ProjectStatus.ACTIVE) {
      this.parentStateBlocked(
        'Project work is available only while the Project is active.',
      );
    }
    if (managerRequired) {
      this.assertProjectManager(project, actor);
    }
  }

  assertProjectManager(
    project: { projectManagerId: string | null },
    actor: ProjectsActorContext,
  ): void {
    if (!actor.employeeId || actor.employeeId !== project.projectManagerId) {
      throw new ForbiddenException({
        code: PROJECTS_ERROR_CODES.PROJECT_RECORD_MANAGER_REQUIRED,
        message: 'Only the current Project Manager may perform this action.',
      });
    }
  }

  private parentStateBlocked(message: string): never {
    throw new DomainConflictException(
      PROJECTS_ERROR_CODES.PROJECT_PARENT_STATE_BLOCKED,
      message,
    );
  }
}
