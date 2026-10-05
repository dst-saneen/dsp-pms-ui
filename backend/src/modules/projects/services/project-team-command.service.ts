import { Injectable } from '@nestjs/common';
import {
  ProjectActionEntityType,
  ProjectTeamMemberStatus,
  Prisma,
} from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type {
  AddProjectTeamMemberDto,
  EndProjectTeamMemberDto,
  UpdateProjectTeamMemberDto,
} from '../dto/project-team.dto';
import type {
  ProjectTeamMemberView,
  ProjectsActorContext,
} from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import {
  PROJECT_NOTIFICATION_EVENT,
  ProjectNotificationService,
} from './project-notification.service';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';
import { ProjectsQueryService } from './projects-query.service';

type DbClient = Prisma.TransactionClient;

@Injectable()
export class ProjectTeamCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly receipts: ProjectCommandReceiptService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly query: ProjectsQueryService,
    private readonly notifications: ProjectNotificationService,
  ) {}

  async add(
    projectId: string,
    dto: AddProjectTeamMemberDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectTeamMemberView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TEAM_ADD',
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        await this.assertEmployeeInCompany(
          tx,
          project.companyId,
          dto.employeeId,
        );

        const existingActive = await tx.projectTeamMember.findFirst({
          where: {
            projectId,
            employeeId: dto.employeeId,
            statusV2: ProjectTeamMemberStatus.ACTIVE,
          },
        });
        if (existingActive) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Employee is already an active team member.',
          );
        }

        const now = new Date();
        const created = await tx.projectTeamMember.create({
          data: {
            companyId: project.companyId,
            projectId,
            employeeId: dto.employeeId,
            role: dto.role.trim(),
            allocationPercentage: dto.allocationPercentage
              ? new Prisma.Decimal(dto.allocationPercentage)
              : new Prisma.Decimal(100),
            startDate: dto.startDate ? new Date(dto.startDate) : now,
            isActive: true,
            allocationStatus: 'ACTIVE',
            statusV2: ProjectTeamMemberStatus.ACTIVE,
            assignedByUserId: actor.userId,
            assignedAt: now,
          },
        });

        await tx.projectTeamMemberHistory.create({
          data: {
            projectTeamMemberId: created.id,
            companyId: project.companyId,
            projectId,
            employeeId: dto.employeeId,
            newRole: created.role,
            newAllocationPercentage: created.allocationPercentage,
            newStartDate: created.startDate,
            action: 'ASSIGNED',
            actorUserId: actor.userId,
            operationId: dto.operationId,
          },
        });

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.TEAM_MEMBER,
            entityId: created.id,
            projectId,
            fromState: null,
            toState: ProjectTeamMemberStatus.ACTIVE,
            actorUserId: actor.userId,
            versionBefore: null,
            versionAfter: created.version,
            operationId: dto.operationId,
          },
        });

        const memberUserId = await this.notifications.resolveEmployeeUserId(
          tx,
          dto.employeeId,
        );
        await this.notifications.enqueue(tx, {
          eventType: PROJECT_NOTIFICATION_EVENT.TEAM_MEMBER_ADDED,
          aggregateType: 'TEAM_MEMBER',
          aggregateId: created.id,
          companyId: project.companyId,
          branchId: currentProject.branchId,
          projectId,
          employeeId: dto.employeeId,
          status: ProjectTeamMemberStatus.ACTIVE,
          version: created.version,
          recipientUserIds: [memberUserId].filter((id): id is string =>
            Boolean(id),
          ),
          dedupeKey: `projects.team.member.added:${created.id}:${created.version}`,
        });

        const view = this.query.toTeamView(created, actor);
        return {
          entityType: 'TEAM_MEMBER',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async update(
    projectId: string,
    memberId: string,
    dto: UpdateProjectTeamMemberDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectTeamMemberView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TEAM_UPDATE',
      operationId: dto.operationId,
      requestPayload: { projectId, memberId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const member = await this.requireMember(
          tx,
          project.companyId,
          projectId,
          memberId,
        );
        if (member.statusV2 !== ProjectTeamMemberStatus.ACTIVE) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Ended team members cannot be edited.',
          );
        }

        const updated = await this.casUpdateMember(
          tx,
          memberId,
          dto.expectedVersion,
          {
            role: dto.role?.trim(),
            allocationPercentage: dto.allocationPercentage
              ? new Prisma.Decimal(dto.allocationPercentage)
              : undefined,
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

        await tx.projectTeamMemberHistory.create({
          data: {
            projectTeamMemberId: member.id,
            companyId: project.companyId,
            projectId,
            employeeId: member.employeeId,
            oldRole: member.role,
            newRole: updated.role,
            oldAllocationPercentage: member.allocationPercentage,
            newAllocationPercentage: updated.allocationPercentage,
            action: 'UPDATED',
            actorUserId: actor.userId,
            operationId: dto.operationId,
          },
        });

        const view = this.query.toTeamView(updated, actor);
        return {
          entityType: 'TEAM_MEMBER',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async end(
    projectId: string,
    memberId: string,
    dto: EndProjectTeamMemberDto,
    actor: ProjectsActorContext,
  ): Promise<ProjectTeamMemberView> {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TEAM_END',
      operationId: dto.operationId,
      requestPayload: { projectId, memberId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const reason = dto.reason.trim();
        const member = await this.requireMember(
          tx,
          project.companyId,
          projectId,
          memberId,
        );
        if (member.statusV2 !== ProjectTeamMemberStatus.ACTIVE) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Team member is already ended.',
          );
        }
        if (member.version !== dto.expectedVersion) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Team member version changed. Reload and retry.',
          );
        }

        const activeTasks = await tx.taskParticipant.count({
          where: {
            projectId,
            employeeId: member.employeeId,
            statusV2: 'ACTIVE',
            task: {
              statusV2: { in: ['ASSIGNED', 'IN_PROGRESS', 'WAITING_REVIEW'] },
            },
          },
        });
        if (activeTasks > 0) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_MEMBER_HAS_ACTIVE_TASKS,
            'Cannot end a member with active task assignments.',
          );
        }

        const now = new Date();
        const result = await tx.projectTeamMember.updateMany({
          where: { id: memberId, version: dto.expectedVersion },
          data: {
            statusV2: ProjectTeamMemberStatus.ENDED,
            isActive: false,
            allocationStatus: 'ENDED',
            endedAt: now,
            endedByUserId: actor.userId,
            endReason: reason,
            endDate: now,
            version: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new DomainConflictException(
            PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
            'Team member version changed. Reload and retry.',
          );
        }

        const updated = await tx.projectTeamMember.findUniqueOrThrow({
          where: { id: memberId },
        });

        await tx.projectTeamMemberHistory.create({
          data: {
            projectTeamMemberId: member.id,
            companyId: project.companyId,
            projectId,
            employeeId: member.employeeId,
            oldRole: member.role,
            action: 'ENDED',
            remarks: reason,
            actorUserId: actor.userId,
            operationId: dto.operationId,
          },
        });

        await tx.projectActionEvent.create({
          data: {
            companyId: project.companyId,
            entityType: ProjectActionEntityType.TEAM_MEMBER,
            entityId: memberId,
            projectId,
            fromState: ProjectTeamMemberStatus.ACTIVE,
            toState: ProjectTeamMemberStatus.ENDED,
            actorUserId: actor.userId,
            versionBefore: member.version,
            versionAfter: updated.version,
            operationId: dto.operationId,
            protectedReason: reason,
          },
        });

        const memberUserId = await this.notifications.resolveEmployeeUserId(
          tx,
          member.employeeId,
        );
        await this.notifications.enqueue(tx, {
          eventType: PROJECT_NOTIFICATION_EVENT.TEAM_MEMBER_ENDED,
          aggregateType: 'TEAM_MEMBER',
          aggregateId: memberId,
          companyId: project.companyId,
          branchId: currentProject.branchId,
          projectId,
          employeeId: member.employeeId,
          status: ProjectTeamMemberStatus.ENDED,
          version: updated.version,
          recipientUserIds: [memberUserId].filter((id): id is string =>
            Boolean(id),
          ),
          dedupeKey: `projects.team.member.ended:${memberId}:${updated.version}`,
        });

        const view = this.query.toTeamView(updated, actor);
        return {
          entityType: 'TEAM_MEMBER',
          entityId: updated.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  private async requireMember(
    tx: DbClient,
    companyId: string,
    projectId: string,
    memberId: string,
  ) {
    const member = await tx.projectTeamMember.findFirst({
      where: { id: memberId, projectId, companyId },
    });
    if (!member) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_NOT_FOUND,
        'Project team member not found',
      );
    }
    return member;
  }

  private async assertEmployeeInCompany(
    tx: DbClient,
    companyId: string,
    employeeId: string,
  ) {
    const employee = await tx.employee.findFirst({
      where: { id: employeeId, companyId, isActive: true },
      select: { id: true },
    });
    if (!employee) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_MANAGER_INVALID,
        'Team member must be an active employee in the same company.',
      );
    }
  }

  private async casUpdateMember(
    tx: DbClient,
    memberId: string,
    expectedVersion: number,
    data: Prisma.ProjectTeamMemberUncheckedUpdateManyInput,
  ) {
    const result = await tx.projectTeamMember.updateMany({
      where: { id: memberId, version: expectedVersion },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count !== 1) {
      throw new DomainConflictException(
        PROJECTS_ERROR_CODES.PROJECT_STATE_CHANGED,
        'Team member version changed. Reload and retry.',
      );
    }
    return tx.projectTeamMember.findUniqueOrThrow({ where: { id: memberId } });
  }
}
