import { Injectable } from '@nestjs/common';
import {
  ProjectActionEntityType,
  ProjectStageStatus,
  Prisma,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type { ProjectCommandDto } from '../dto/project-command.dto';
import type {
  CreateProjectStageDto,
  UpdateProjectStageDto,
} from '../dto/project-stage.dto';
import { resolveUniqueProjectCode } from '../lib/project-code';
import { canTransitionStage } from '../policies/project-transitions';
import type {
  ProjectStageView,
  ProjectsActorContext,
} from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectsQueryService } from './projects-query.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class ProjectStageCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ProjectCommandReceiptService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly query: ProjectsQueryService,
  ) {}

  async create(
    projectId: string,
    dto: CreateProjectStageDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectStageView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_STAGE_CREATE',
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const lockedProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(lockedProject, actor);
        let stageCode: string;
        try {
          stageCode = await resolveUniqueProjectCode({
            requestedCode: dto.stageCode,
            displayName: dto.stageName,
            fallback: 'STAGE',
            exists: async (candidate) =>
              Boolean(
                await tx.projectStage.findFirst({
                  where: { projectId, stageCode: candidate },
                  select: { id: true },
                }),
              ),
          });
        } catch (error) {
          const message =
            error instanceof Error && error.message === 'CODE_EXISTS'
              ? 'Stage code already exists on this project.'
              : 'Unable to generate a unique stage code.';
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            message,
          );
        }

        const created = await tx.projectStage.create({
          data: {
            companyId: project.companyId,
            projectId,
            stageCode,
            stageName: dto.stageName.trim(),
            description: dto.description?.trim(),
            sequenceNo: dto.sequenceNo,
            startDate: dto.startDate ? new Date(dto.startDate) : null,
            endDate: dto.endDate ? new Date(dto.endDate) : null,
            status: 'PLANNED',
            statusV2: ProjectStageStatus.PLANNED,
          },
        });

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.STAGE,
            entityId: created.id,
            projectId,
            fromState: null,
            toState: ProjectStageStatus.PLANNED,
            actorUserId: actor.userId,
            versionBefore: null,
            versionAfter: created.version,
            operationId: dto.operationId,
          },
        });

        const view = this.query.toStageView(created, actor);
        return {
          entityType: 'STAGE',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async update(
    projectId: string,
    stageId: string,
    dto: UpdateProjectStageDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectStageView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_STAGE_UPDATE',
      operationId: dto.operationId,
      requestPayload: { projectId, stageId, ...dto },
      execute: async (tx) => {
        const lockedProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(lockedProject, actor);
        const stage = await this.requireStage(
          tx,
          project.companyId,
          projectId,
          stageId,
        );
        if (
          stage.statusV2 === ProjectStageStatus.COMPLETED ||
          stage.statusV2 === ProjectStageStatus.CANCELLED
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Completed or cancelled stages cannot be edited.',
          );
        }

        const updated = await this.casUpdateStage(
          tx,
          stageId,
          dto.expectedVersion,
          {
            stageName: dto.stageName?.trim(),
            description:
              dto.description === undefined ? undefined : dto.description,
            sequenceNo: dto.sequenceNo,
            startDate:
              dto.startDate === undefined
                ? undefined
                : dto.startDate
                  ? new Date(dto.startDate)
                  : null,
            endDate:
              dto.endDate === undefined
                ? undefined
                : dto.endDate
                  ? new Date(dto.endDate)
                  : null,
          },
        );

        const view = this.query.toStageView(updated, actor);
        return {
          entityType: 'STAGE',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  activate(
    projectId: string,
    stageId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.transition(projectId, stageId, dto, actor, {
      commandType: 'PROJECT_STAGE_ACTIVATE',
      toStatus: ProjectStageStatus.ACTIVE,
      patch: (now, userId) => ({
        activatedAt: now,
        activatedByUserId: userId,
        status: 'ACTIVE',
      }),
    });
  }

  complete(
    projectId: string,
    stageId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.transition(projectId, stageId, dto, actor, {
      commandType: 'PROJECT_STAGE_COMPLETE',
      toStatus: ProjectStageStatus.COMPLETED,
      patch: (now, userId) => ({
        completedAt: now,
        completedByUserId: userId,
        status: 'COMPLETED',
      }),
    });
  }

  cancel(
    projectId: string,
    stageId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
  ) {
    return this.transition(projectId, stageId, dto, actor, {
      commandType: 'PROJECT_STAGE_CANCEL',
      toStatus: ProjectStageStatus.CANCELLED,
      requiresReason: true,
      patch: (now, userId, reason) => ({
        cancelledAt: now,
        cancelledByUserId: userId,
        cancellationReason: reason ?? null,
        status: 'CANCELLED',
      }),
    });
  }

  private async transition(
    projectId: string,
    stageId: string,
    dto: ProjectCommandDto,
    actor: ProjectsActorContext,
    options: {
      commandType: string;
      toStatus: ProjectStageStatus;
      patch: (
        now: Date,
        userId: string,
        reason?: string,
      ) => Prisma.ProjectStageUncheckedUpdateManyInput;
      requiresReason?: boolean;
    },
  ): Promise<ProjectStageView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: options.commandType,
      operationId: dto.operationId,
      requestPayload: { projectId, stageId, ...dto },
      execute: async (tx) => {
        const lockedProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertActiveWorkAuthority(lockedProject, actor, true);
        if (options.requiresReason && !dto.reason?.trim()) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'A reason is required for this action.',
          );
        }
        const stage = await this.requireStage(
          tx,
          project.companyId,
          projectId,
          stageId,
        );
        if (
          !canTransitionStage(stage.statusV2 ?? 'PLANNED', options.toStatus)
        ) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            `Cannot transition stage from ${stage.statusV2} to ${options.toStatus}.`,
          );
        }
        if (stage.version !== dto.expectedVersion) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Stage version changed. Reload and retry.',
          );
        }

        const now = new Date();
        const result = await tx.projectStage.updateMany({
          where: { id: stageId, version: dto.expectedVersion },
          data: {
            ...options.patch(now, actor.userId, dto.reason),
            statusV2: options.toStatus,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Stage version changed. Reload and retry.',
          );
        }

        const updated = await tx.projectStage.findUniqueOrThrow({
          where: { id: stageId },
        });

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.STAGE,
            entityId: stageId,
            projectId,
            fromState: stage.statusV2,
            toState: options.toStatus,
            actorUserId: actor.userId,
            versionBefore: stage.version,
            versionAfter: updated.version,
            operationId: dto.operationId,
            protectedReason: dto.reason,
          },
        });

        const view = this.query.toStageView(updated, actor);
        return {
          entityType: 'STAGE',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private async requireStage(
    tx: DbClient,
    companyId: string,
    projectId: string,
    stageId: string,
  ) {
    const stage = await tx.projectStage.findFirst({
      where: { id: stageId, projectId, companyId },
    });
    if (!stage) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_STAGE_NOT_FOUND,
        'Project stage not found',
      );
    }
    return stage;
  }

  private async casUpdateStage(
    tx: DbClient,
    stageId: string,
    expectedVersion: number,
    data: Prisma.ProjectStageUncheckedUpdateManyInput,
  ) {
    const result = await tx.projectStage.updateMany({
      where: { id: stageId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
        'Stage version changed. Reload and retry.',
      );
    }
    return tx.projectStage.findUniqueOrThrow({ where: { id: stageId } });
  }
}
