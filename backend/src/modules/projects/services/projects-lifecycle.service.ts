import { Injectable } from '@nestjs/common';
import {
  BusinessPartyType,
  ProjectActionEntityType,
  ProjectStatus,
  ProjectType,
  Prisma,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { NumberSeriesService } from '../../number-series/number-series.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type {
  CreateProjectDto,
  UpdateProjectDto,
} from '../dto/create-project.dto';
import type { ProjectCommandDto } from '../dto/project-command.dto';
import { canTransitionProject } from '../policies/project-transitions';
import type {
  ProjectDetailView,
  ProjectsActorContext,
} from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import {
  PROJECT_NOTIFICATION_EVENT,
  ProjectNotificationService,
  type ProjectNotificationEvent,
} from './project-notification.service';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { OfficeFinanceFeatureService } from '../../office-finance/services/office-finance-feature.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectsQueryService } from './projects-query.service';

type DbClient = Prisma.TransactionClient;

const LIFECYCLE_NOTIFY: Partial<Record<string, ProjectNotificationEvent>> = {
  PROJECT_ACTIVATE: PROJECT_NOTIFICATION_EVENT.PROJECT_ACTIVATED,
  PROJECT_HOLD: PROJECT_NOTIFICATION_EVENT.PROJECT_HELD,
  PROJECT_RESUME: PROJECT_NOTIFICATION_EVENT.PROJECT_RESUMED,
  PROJECT_COMPLETE: PROJECT_NOTIFICATION_EVENT.PROJECT_COMPLETED,
  PROJECT_CANCEL: PROJECT_NOTIFICATION_EVENT.PROJECT_CANCELLED,
};

@Injectable()
export class ProjectsLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ProjectCommandReceiptService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly numberSeries: NumberSeriesService,
    private readonly query: ProjectsQueryService,
    private readonly notifications: ProjectNotificationService,
    private readonly officeFinance: OfficeFinanceFeatureService,
  ) {}

  async create(
    dto: CreateProjectDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectDetailView> {
    const companyId = this.scope.requireCompanyId(actor.companyId);
    await this.gate.assertEnabledForContext(companyId);
    await this.assertCreatePartyRules(dto, companyId);

    if (dto.projectManagerId) {
      await this.assertValidManager(companyId, dto.projectManagerId);
    }

    if (dto.branchId) {
      await this.assertBranchInCompany(companyId, dto.branchId);
    }

    return this.receipts.claimOrReplay({
      companyId,
      commandType: 'PROJECT_CREATE',
      operationId: dto.operationId,
      requestPayload: dto,
      execute: async (tx) => {
        const branchId = dto.branchId ?? actor.branchId ?? null;
        if (branchId) {
          await this.assertBranchInCompany(companyId, branchId, tx);
        }
        if (dto.projectManagerId) {
          await this.assertValidManager(companyId, dto.projectManagerId, tx);
        }
        await this.assertBusinessParty(
          companyId,
          dto.projectType,
          dto.businessPartyId ?? null,
          tx,
        );
        const currencyCode = await this.resolveCommercialCurrency(
          companyId,
          dto.expectedIncome,
          dto.expenseBudget,
          tx,
        );
        const projectCode = await this.numberSeries.next(
          'PROJECT',
          companyId,
          'PRJ',
          6,
          tx,
        );

        const created = await tx.project.create({
          data: {
            projectCode,
            projectName: dto.projectName.trim(),
            description: dto.description?.trim(),
            projectType: dto.projectType,
            businessPartyId: dto.businessPartyId ?? null,
            companyId,
            branchId,
            projectManagerId: dto.projectManagerId ?? null,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            expectedIncome: dto.expectedIncome
              ? new Prisma.Decimal(dto.expectedIncome)
              : null,
            expenseBudget: dto.expenseBudget
              ? new Prisma.Decimal(dto.expenseBudget)
              : null,
            currencyCode,
            status: 'DRAFT',
            statusV2: ProjectStatus.DRAFT,
            createdBy: actor.userId,
            updatedBy: actor.userId,
          },
        });

        await this.writeActionEvent(tx, {
          companyId,
          entityType: ProjectActionEntityType.PROJECT,
          entityId: created.id,
          projectId: created.id,
          fromState: null,
          toState: ProjectStatus.DRAFT,
          actorUserId: actor.userId,
          versionBefore: null,
          versionAfter: created.version,
          operationId: dto.operationId,
        });

        const view = this.query.toProjectView(created, actor);
        return {
          entityType: 'PROJECT',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async update(
    projectId: string,
    dto: UpdateProjectDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectDetailView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    if (
      project.statusV2 !== ProjectStatus.DRAFT &&
      project.statusV2 !== ProjectStatus.ACTIVE
    ) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
        'Project cannot be edited in the current state.',
      );
    }

    if (dto.projectManagerId) {
      await this.assertValidManager(project.companyId, dto.projectManagerId);
    }

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_UPDATE',
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const locked = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(locked, actor);
        if (locked.version !== dto.expectedVersion) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Project version changed. Reload and retry.',
          );
        }
        const branchId =
          dto.branchId === undefined ? locked.branchId : dto.branchId;
        const projectManagerId =
          dto.projectManagerId === undefined
            ? locked.projectManagerId
            : dto.projectManagerId;
        const businessPartyId =
          dto.businessPartyId === undefined
            ? locked.businessPartyId
            : dto.businessPartyId;
        if (branchId) {
          await this.assertBranchInCompany(locked.companyId, branchId, tx);
        }
        if (projectManagerId) {
          await this.assertValidManager(locked.companyId, projectManagerId, tx);
        }
        await this.assertBusinessParty(
          locked.companyId,
          locked.projectType,
          businessPartyId,
          tx,
        );
        const expectedIncome =
          dto.expectedIncome === undefined
            ? locked.expectedIncome?.toString()
            : dto.expectedIncome;
        const expenseBudget =
          dto.expenseBudget === undefined
            ? locked.expenseBudget?.toString()
            : dto.expenseBudget;
        const currencyCode = await this.resolveCommercialCurrency(
          locked.companyId,
          expectedIncome,
          expenseBudget,
          tx,
        );
        const updated = await this.casUpdateProject(
          tx,
          project.id,
          dto.expectedVersion,
          {
            projectName: dto.projectName?.trim(),
            description:
              dto.description === undefined ? undefined : dto.description,
            businessPartyId:
              dto.businessPartyId === undefined
                ? undefined
                : dto.businessPartyId,
            branchId: dto.branchId === undefined ? undefined : dto.branchId,
            projectManagerId:
              dto.projectManagerId === undefined
                ? undefined
                : dto.projectManagerId,
            startDate: this.optionalDate(dto.startDate),
            endDate: this.optionalDate(dto.endDate),
            expectedIncome: this.optionalDecimal(dto.expectedIncome),
            expenseBudget: this.optionalDecimal(dto.expenseBudget),
            currencyCode,
            updatedBy: actor.userId,
          },
        );

        const view = this.query.toProjectView(updated, actor);
        return {
          entityType: 'PROJECT',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  activate(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_ACTIVATE',
      toStatus: ProjectStatus.ACTIVE,
      before: async (project) => {
        const blockers = await this.collectActivationBlockers(project);
        if (blockers.length > 0) {
          throw new DomainConflictException(
            blockers[0].code,
            blockers.map((b) => b.message).join(' '),
          );
        }
      },
      patch: (now, userId) => ({
        activatedAt: now,
        activatedByUserId: userId,
        status: 'ACTIVE',
      }),
    });
  }

  hold(projectId: string, dto: ProjectCommandDto, actor: ProjectsActorContext) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_HOLD',
      toStatus: ProjectStatus.ON_HOLD,
      managerRequired: true,
      patch: (now, userId, reason) => ({
        heldAt: now,
        heldByUserId: userId,
        holdReason: reason ?? null,
        status: 'ON_HOLD',
      }),
    });
  }

  resume(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_RESUME',
      toStatus: ProjectStatus.ACTIVE,
      managerRequired: true,
      patch: (now, userId) => ({
        resumedAt: now,
        resumedByUserId: userId,
        status: 'ACTIVE',
      }),
    });
  }

  complete(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_COMPLETE',
      toStatus: ProjectStatus.COMPLETED,
      managerRequired: true,
      before: async (project, tx) => {
        await this.assertProjectCompletionReady(
          tx,
          project.id,
          project.companyId,
        );
      },
      patch: (now, userId) => ({
        completedAt: now,
        completedByUserId: userId,
        status: 'COMPLETED',
      }),
    });
  }

  cancel(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_CANCEL',
      toStatus: ProjectStatus.CANCELLED,
      managerRequired: true,
      requiresReason: true,
      patch: (now, userId, reason) => ({
        cancelledAt: now,
        cancelledByUserId: userId,
        cancellationReason: reason ?? null,
        status: 'CANCELLED',
      }),
    });
  }

  archive(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.lifecycleTransition(projectId, dto, actor, {
      commandType: 'PROJECT_ARCHIVE',
      toStatus: null,
      before: async (project) => {
        await Promise.resolve();
        if (
          project.statusV2 !== ProjectStatus.DRAFT &&
          project.statusV2 !== ProjectStatus.COMPLETED &&
          project.statusV2 !== ProjectStatus.CANCELLED
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Only draft, completed or cancelled projects can be archived.',
          );
        }
        if (project.archivedAt) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Project is already archived.',
          );
        }
      },
      patch: (now, userId, reason) => ({
        archivedAt: now,
        archivedByUserId: userId,
        archiveReason: reason ?? null,
      }),
    });
  }

  private async lifecycleTransition(
    projectId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
    options: {
      commandType: string;
      toStatus: ProjectStatus | null;
      managerRequired?: boolean;
      requiresReason?: boolean;
      before?: (
        project: Awaited<
          ReturnType<ProjectsDomainScopeService['requireProject']>
        >,
        tx: DbClient,
      ) => Promise<void>;
      patch: (
        now: Date,
        userId: string,
        reason?: string,
      ) => Prisma.ProjectUncheckedUpdateManyInput;
    },
  ): Promise<ProjectDetailView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    if (
      options.toStatus &&
      !canTransitionProject(project.statusV2 ?? 'DRAFT', options.toStatus)
    ) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
        `Cannot transition project from ${project.statusV2} to ${options.toStatus}.`,
      );
    }

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: options.commandType,
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const locked = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );

        if (locked.version !== dto.expectedVersion) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Project version changed. Reload and retry.',
          );
        }
        if (options.managerRequired) {
          this.scope.assertProjectManager(locked, actor);
        }

        const reason = dto.reason?.trim();
        if (options.requiresReason && !reason) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_REASON_REQUIRED,
            'A reason is required for this action.',
          );
        }

        if (options.before) {
          await options.before(locked, tx);
        }

        if (
          options.toStatus &&
          !canTransitionProject(locked.statusV2 ?? 'DRAFT', options.toStatus)
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            `Cannot transition project from ${locked.statusV2} to ${options.toStatus}.`,
          );
        }

        const now = new Date();
        const data: Prisma.ProjectUncheckedUpdateManyInput = {
          ...options.patch(now, actor.userId, reason),
          version: { increment: 1 },
          updatedBy: actor.userId,
          ...(options.toStatus ? { statusV2: options.toStatus } : {}),
        };

        const result = await tx.project.updateMany({
          where: { id: projectId, version: dto.expectedVersion },
          data,
        });

        if (result.count !== 1) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Project version changed. Reload and retry.',
          );
        }

        const updated = await tx.project.findUniqueOrThrow({
          where: { id: projectId },
        });

        await this.writeActionEvent(tx, {
          companyId: project.companyId,
          entityType: ProjectActionEntityType.PROJECT,
          entityId: projectId,
          projectId,
          fromState: locked.statusV2,
          toState: options.toStatus ?? locked.statusV2 ?? 'DRAFT',
          actorUserId: actor.userId,
          versionBefore: locked.version,
          versionAfter: updated.version,
          operationId: dto.operationId,
          protectedReason: reason,
        });

        const notifyType = LIFECYCLE_NOTIFY[options.commandType];
        if (notifyType) {
          const managerUserId = await this.notifications.resolveManagerUserId(
            tx,
            updated.projectManagerId,
          );
          await this.notifications.enqueue(tx, {
            eventType: notifyType,
            aggregateType: 'PROJECT',
            aggregateId: projectId,
            companyId: project.companyId,
            branchId: updated.branchId,
            projectId,
            status: String(options.toStatus ?? updated.statusV2),
            version: updated.version,
            recipientUserIds: [managerUserId, actor.userId].filter(
              (id): id is string => Boolean(id),
            ),
            dedupeKey: `${notifyType}:${projectId}:${updated.version}`,
          });
        }

        const view = this.query.toProjectView(updated, actor);
        return {
          entityType: 'PROJECT',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private async casUpdateProject(
    tx: DbClient,
    projectId: string,
    expectedVersion: number,
    data: Prisma.ProjectUncheckedUpdateManyInput,
  ) {
    const result = await tx.project.updateMany({
      where: { id: projectId, version: expectedVersion },
      data: {
        ...data,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
        'Project version changed. Reload and retry.',
      );
    }
    return tx.project.findUniqueOrThrow({ where: { id: projectId } });
  }

  private async assertCreatePartyRules(
    dto: CreateProjectDto,
    companyId: string,
  ) {
    const financeEnabled =
      await this.officeFinance.isEnabledForCompany(companyId);

    if (dto.projectType === ProjectType.CLIENT) {
      if (!financeEnabled) {
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
          'Client projects are unavailable until Finance is enabled for this Company.',
        );
      }
      if (!dto.businessPartyId) {
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
          'Client projects require a customer / business party.',
        );
      }
    }
    if (dto.projectType === ProjectType.INTERNAL && dto.businessPartyId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
        'Internal projects cannot have a business party.',
      );
    }
  }

  async getActivationPreflight(
    projectId: string,
    actor: ProjectsActorContext,
  ): Promise<{
    ready: boolean;
    blockers: Array<{ code: string; message: string }>;
  }> {
    void actor;
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    const blockers = await this.collectActivationBlockers(project);
    return { ready: blockers.length === 0, blockers };
  }

  private async collectActivationBlockers(project: {
    id: string;
    companyId: string;
    projectType: ProjectType;
    businessPartyId: string | null;
    projectManagerId: string | null;
    startDate: Date | null;
    expectedIncome: Prisma.Decimal | null;
    expenseBudget: Prisma.Decimal | null;
  }): Promise<Array<{ code: string; message: string }>> {
    const blockers: Array<{ code: string; message: string }> = [];

    if (!project.projectManagerId) {
      blockers.push({
        code: PROJECTS_ERROR_CODES.PROJECT_ACTIVATION_PRECONDITION_FAILED,
        message: 'Project Manager is required before activation.',
      });
    } else {
      try {
        await this.assertValidManager(
          project.companyId,
          project.projectManagerId,
        );
      } catch {
        blockers.push({
          code: PROJECTS_ERROR_CODES.PROJECT_MANAGER_INVALID,
          message:
            'Project Manager must be an active employee with an active user account.',
        });
      }
    }

    if (!project.startDate) {
      blockers.push({
        code: PROJECTS_ERROR_CODES.PROJECT_ACTIVATION_PRECONDITION_FAILED,
        message: 'Start date is required before activation.',
      });
    }

    const stageCount = await this.prisma.projectStage.count({
      where: { projectId: project.id, companyId: project.companyId },
    });
    if (stageCount < 1) {
      blockers.push({
        code: PROJECTS_ERROR_CODES.PROJECT_ACTIVATION_PRECONDITION_FAILED,
        message: 'At least one stage is required before activation.',
      });
    }

    if (project.projectType === ProjectType.CLIENT) {
      const financeEnabled = await this.officeFinance.isEnabledForCompany(
        project.companyId,
      );
      if (!financeEnabled) {
        blockers.push({
          code: PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
          message:
            'Client project activation is blocked until Finance is enabled for this Company.',
        });
      }
      if (!project.businessPartyId) {
        blockers.push({
          code: PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
          message:
            'Client projects require a business party before activation.',
        });
      } else {
        try {
          await this.assertBusinessParty(
            project.companyId,
            project.projectType,
            project.businessPartyId,
          );
        } catch {
          blockers.push({
            code: PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
            message:
              'Client project party must be an active CUSTOMER or BOTH party in the same Company.',
          });
        }
      }
    }

    if (
      project.projectType === ProjectType.INTERNAL &&
      project.businessPartyId
    ) {
      blockers.push({
        code: PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
        message: 'Internal projects cannot have a business party.',
      });
    }

    if (project.expectedIncome != null || project.expenseBudget != null) {
      try {
        await this.resolveCommercialCurrency(
          project.companyId,
          project.expectedIncome?.toString(),
          project.expenseBudget?.toString(),
        );
      } catch {
        blockers.push({
          code: PROJECTS_ERROR_CODES.PROJECT_ACTIVATION_PRECONDITION_FAILED,
          message:
            'Commercial Project amounts require the Company Finance base currency.',
        });
      }
    }

    return blockers;
  }

  private async assertValidManager(
    companyId: string,
    employeeId: string,
    tx?: DbClient,
  ) {
    const db = tx ?? this.prisma;
    const employee = await db.employee.findFirst({
      where: {
        id: employeeId,
        companyId,
        isActive: true,
      },
      select: {
        id: true,
        user: { select: { id: true, status: true } },
      },
    });
    if (!employee) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_MANAGER_INVALID,
        'Project Manager must be an active employee in the same company.',
      );
    }
    if (!employee.user?.id || employee.user.status !== 'ACTIVE') {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_MANAGER_INVALID,
        'Project Manager must have an active user account.',
      );
    }
  }

  private async assertBusinessParty(
    companyId: string,
    projectType: ProjectType,
    businessPartyId: string | null,
    tx?: DbClient,
  ) {
    if (projectType === ProjectType.INTERNAL) {
      if (businessPartyId) {
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
          'Internal projects cannot have a business party.',
        );
      }
      return;
    }
    if (!businessPartyId) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
        'Client projects require an active customer / business party.',
      );
    }
    const db = tx ?? this.prisma;
    const party = await db.businessParty.findFirst({
      where: {
        id: businessPartyId,
        companyId,
        isActive: true,
        archivedAt: null,
        partyType: {
          in: [BusinessPartyType.CUSTOMER, BusinessPartyType.BOTH],
        },
      },
      select: { id: true },
    });
    if (!party) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_PARTY_INVALID,
        'Client project party must be an active CUSTOMER or BOTH party in the same Company.',
      );
    }
  }

  private async resolveCommercialCurrency(
    companyId: string,
    expectedIncome: string | null | undefined,
    expenseBudget: string | null | undefined,
    tx?: DbClient,
  ): Promise<string | null> {
    if (expectedIncome == null && expenseBudget == null) {
      return null;
    }
    const db = tx ?? this.prisma;
    const profile = await db.companyFinancialProfile.findUnique({
      where: { companyId },
      select: { baseCurrencyCode: true },
    });
    if (!profile?.baseCurrencyCode) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_ACTIVATION_PRECONDITION_FAILED,
        'Commercial Project amounts require the Company Finance base currency.',
      );
    }
    return profile.baseCurrencyCode;
  }

  private async assertBranchInCompany(
    companyId: string,
    branchId: string,
    tx?: DbClient,
  ) {
    const db = tx ?? this.prisma;
    const branch = await db.branch.findFirst({
      where: { id: branchId, companyId, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Branch not found for company.',
      );
    }
  }

  private async assertProjectCompletionReady(
    tx: DbClient,
    projectId: string,
    companyId: string,
  ) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "project_stages"
      WHERE "projectId" = ${projectId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);
    await tx.$queryRaw(Prisma.sql`
      SELECT id FROM "project_tasks"
      WHERE "projectId" = ${projectId} AND "companyId" = ${companyId}
      FOR UPDATE
    `);

    const [unfinishedStages, unfinishedTasks, openSubmissions, submittedLogs] =
      await Promise.all([
        tx.projectStage.count({
          where: {
            projectId,
            companyId,
            statusV2: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        }),
        tx.projectTask.count({
          where: {
            projectId,
            companyId,
            statusV2: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        }),
        tx.taskSubmission.count({
          where: {
            projectId,
            companyId,
            statusV2: 'SUBMITTED',
          },
        }),
        tx.workLogHeader.count({
          where: {
            companyId,
            statusV2: 'SUBMITTED',
            lines: { some: { task: { projectId, companyId } } },
          },
        }),
      ]);
    if (
      unfinishedStages > 0 ||
      unfinishedTasks > 0 ||
      openSubmissions > 0 ||
      submittedLogs > 0
    ) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_HAS_ACTIVE_WORK,
        'Project completion requires every non-cancelled Stage and Task to be completed, no open submission, and no submitted Timesheet awaiting decision.',
      );
    }
  }

  private async writeActionEvent(
    tx: DbClient,
    input: {
      companyId: string;
      entityType: ProjectActionEntityType;
      entityId: string;
      projectId: string;
      fromState: string | null;
      toState: string;
      actorUserId: string;
      versionBefore: number | null;
      versionAfter: number;
      operationId: string;
      protectedReason?: string;
    },
  ) {
    await tx.projectActionEvent.create({
      data: {
        companyId: input.companyId,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        fromState: input.fromState,
        toState: input.toState,
        actorUserId: input.actorUserId,
        versionBefore: input.versionBefore,
        versionAfter: input.versionAfter,
        operationId: input.operationId,
        protectedReason: input.protectedReason,
      },
    });
  }

  private optionalDate(
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value ? new Date(value) : null;
  }

  private optionalDecimal(
    value: string | null | undefined,
  ): Prisma.Decimal | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    return value ? new Prisma.Decimal(value) : null;
  }
}
