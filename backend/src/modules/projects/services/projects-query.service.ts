import { Injectable } from '@nestjs/common';
import type {
  Project,
  ProjectStage,
  ProjectTask,
  ProjectTeamMember,
} from '@prisma/client';
import { Prisma } from '@prisma/client';

import { DomainNotFoundException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import { computeProjectAllowedActions } from '../policies/project-allowed-actions';
import { computeProjectTaskAllowedActions } from '../policies/project-task-allowed-actions';
import type {
  ProjectDetailView,
  ProjectStageView,
  ProjectTaskView,
  ProjectTeamMemberView,
  ProjectsActorContext,
} from '../types/project.types';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';

function decimalToString(
  value: Prisma.Decimal | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  return value.toString();
}

function dateToIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

@Injectable()
export class ProjectsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectsDomainScopeService,
  ) {}

  async listProjects(
    actor: ProjectsActorContext,
    query: {
      keyword?: string;
      status?: string;
      page?: number;
      limit?: number;
      sortBy?: 'projectCode' | 'projectName' | 'status' | 'createdAt';
      sortDir?: 'asc' | 'desc';
    },
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const keyword = query.keyword?.trim();

    const where: Prisma.ProjectWhereInput = {
      ...this.scope.projectWhere(),
      archivedAt: null,
      ...(query.status
        ? { statusV2: query.status as Project['statusV2'] }
        : {}),
      ...(keyword
        ? {
            OR: [
              { projectCode: { contains: keyword, mode: 'insensitive' } },
              { projectName: { contains: keyword, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        orderBy:
          query.sortBy === 'status'
            ? { statusV2: query.sortDir === 'asc' ? 'asc' : 'desc' }
            : query.sortBy
              ? { [query.sortBy]: query.sortDir === 'asc' ? 'asc' : 'desc' }
              : { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map((row) => this.toProjectView(row, actor)),
      total,
      page,
      limit,
    };
  }

  async getProject(
    projectId: string,
    actor: ProjectsActorContext,
  ): Promise<ProjectDetailView> {
    const project = await this.scope.requireProject(projectId);
    return this.toProjectView(project, actor);
  }

  async listStages(projectId: string, actor: ProjectsActorContext) {
    await this.scope.requireProject(projectId);
    const rows = await this.prisma.projectStage.findMany({
      where: { projectId },
      orderBy: { sequenceNo: 'asc' },
    });
    return rows.map((row) => this.toStageView(row, actor));
  }

  async listTeam(projectId: string, actor: ProjectsActorContext) {
    await this.scope.requireProject(projectId);
    const rows = await this.prisma.projectTeamMember.findMany({
      where: { projectId },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toTeamView(row, actor));
  }

  async listTasks(projectId: string, actor: ProjectsActorContext) {
    const project = await this.scope.requireProject(projectId);
    const rows = await this.prisma.projectTask.findMany({
      where: { projectId },
      include: {
        participants: {
          where: { statusV2: 'ACTIVE' },
          select: { employeeId: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) =>
      this.toTaskView(
        row,
        project.statusV2,
        project.projectManagerId,
        row.participants.map((p) => p.employeeId),
        actor,
      ),
    );
  }

  async getTask(
    projectId: string,
    taskId: string,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    const task = await this.prisma.projectTask.findFirst({
      where: { id: taskId, projectId, companyId: project.companyId },
      include: {
        participants: {
          where: { statusV2: 'ACTIVE' },
          select: { employeeId: true },
        },
        submissions: {
          include: {
            reviews: { orderBy: { reviewRound: 'asc' } },
            documents: { orderBy: { uploadedAt: 'asc' } },
          },
          orderBy: { versionNo: 'desc' },
        },
        assignmentHistory: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });
    if (!task) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_NOT_FOUND,
        'Project task not found',
      );
    }
    return this.toTaskDetail(
      task,
      project.statusV2,
      project.projectManagerId,
      actor,
    );
  }

  async listMyTasks(actor: ProjectsActorContext) {
    if (!actor.employeeId) {
      return { items: [], total: 0, page: 1, limit: 20 };
    }

    const rows = await this.prisma.projectTask.findMany({
      where: {
        project: this.scope.projectWhere(),
        participants: {
          some: {
            employeeId: actor.employeeId,
            statusV2: 'ACTIVE',
          },
        },
        statusV2: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
      include: {
        project: {
          select: {
            statusV2: true,
            projectManagerId: true,
            projectCode: true,
            projectName: true,
          },
        },
        participants: {
          where: { statusV2: 'ACTIVE' },
          select: { employeeId: true },
        },
        submissions: {
          include: {
            reviews: { orderBy: { reviewRound: 'asc' } },
            documents: { orderBy: { uploadedAt: 'asc' } },
          },
          orderBy: { versionNo: 'desc' },
        },
        assignmentHistory: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
      orderBy: { dueDate: 'asc' },
      take: 100,
    });

    return {
      items: rows.map((row) => ({
        ...this.toTaskView(
          row,
          row.project.statusV2,
          row.project.projectManagerId,
          row.participants.map((p) => p.employeeId),
          actor,
        ),
        projectCode: row.project.projectCode,
        projectName: row.project.projectName,
      })),
      total: rows.length,
      page: 1,
      limit: 100,
    };
  }

  async getMyTask(taskId: string, actor: ProjectsActorContext) {
    if (!actor.employeeId) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_NOT_FOUND,
        'Project task not found',
      );
    }

    const task = await this.prisma.projectTask.findFirst({
      where: {
        id: taskId,
        project: this.scope.projectWhere(),
        participants: {
          some: {
            employeeId: actor.employeeId,
            statusV2: 'ACTIVE',
          },
        },
      },
      include: {
        project: { select: { statusV2: true, projectManagerId: true } },
        participants: {
          where: { statusV2: 'ACTIVE' },
          select: { employeeId: true },
        },
        submissions: {
          include: {
            reviews: { orderBy: { reviewRound: 'asc' } },
            documents: { orderBy: { uploadedAt: 'asc' } },
          },
          orderBy: { versionNo: 'desc' },
        },
        assignmentHistory: { orderBy: { createdAt: 'desc' } },
        documents: { orderBy: { uploadedAt: 'desc' } },
      },
    });

    if (!task) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_TASK_NOT_FOUND,
        'Project task not found',
      );
    }

    return this.toTaskDetail(
      task,
      task.project.statusV2,
      task.project.projectManagerId,
      actor,
    );
  }

  toProjectView(
    project: Project,
    actor: ProjectsActorContext,
  ): ProjectDetailView {
    const status = project.statusV2 ?? 'DRAFT';
    return {
      id: project.id,
      version: project.version,
      projectCode: project.projectCode,
      projectName: project.projectName,
      description: project.description,
      projectType: project.projectType ?? 'INTERNAL',
      status,
      companyId: project.companyId,
      branchId: project.branchId,
      projectManagerId: project.projectManagerId,
      businessPartyId: project.businessPartyId,
      currencyCode: project.currencyCode,
      expectedIncome: decimalToString(project.expectedIncome),
      expenseBudget: decimalToString(project.expenseBudget),
      startDate: dateToIso(project.startDate),
      endDate: dateToIso(project.endDate),
      archivedAt: dateToIso(project.archivedAt),
      allowedActions: computeProjectAllowedActions({
        status,
        archivedAt: project.archivedAt,
        projectManagerId: project.projectManagerId,
        actor,
      }),
      actionRequirements: { expectedVersion: project.version },
    };
  }

  toStageView(
    stage: ProjectStage,
    actor: ProjectsActorContext,
  ): ProjectStageView {
    const canManage = actor.permissions.includes('projects.projects.manage');
    const status = stage.statusV2 ?? 'PLANNED';
    const actions: ProjectStageView['allowedActions'] = [];
    if (canManage) {
      if (status === 'PLANNED') {
        actions.push('EDIT', 'ACTIVATE', 'CANCEL');
      } else if (status === 'ACTIVE') {
        actions.push('EDIT', 'COMPLETE', 'CANCEL');
      }
    }
    return {
      id: stage.id,
      version: stage.version,
      projectId: stage.projectId,
      stageCode: stage.stageCode,
      stageName: stage.stageName,
      description: stage.description,
      sequenceNo: stage.sequenceNo,
      status,
      startDate: dateToIso(stage.startDate),
      endDate: dateToIso(stage.endDate),
      allowedActions: actions,
      actionRequirements: { expectedVersion: stage.version },
    };
  }

  toTeamView(
    member: ProjectTeamMember & {
      employee?: {
        firstName: string;
        lastName: string | null;
        employeeCode: string;
      } | null;
    },
    actor: ProjectsActorContext,
  ): ProjectTeamMemberView {
    const canManage = actor.permissions.includes('projects.projects.manage');
    const status = member.statusV2 ?? 'ACTIVE';
    const actions: ProjectTeamMemberView['allowedActions'] = [];
    if (canManage && status === 'ACTIVE') {
      actions.push('EDIT', 'END');
    }
    const displayName = member.employee
      ? [member.employee.firstName, member.employee.lastName]
          .filter(Boolean)
          .join(' ')
      : null;
    return {
      id: member.id,
      version: member.version,
      projectId: member.projectId,
      employeeId: member.employeeId,
      displayName,
      employeeCode: member.employee?.employeeCode ?? null,
      role: member.role,
      status,
      allocationPercentage: member.allocationPercentage.toString(),
      startDate: dateToIso(member.startDate),
      endDate: dateToIso(member.endDate),
      allowedActions: actions,
      actionRequirements: { expectedVersion: member.version },
    };
  }

  toTaskView(
    task: ProjectTask,
    projectStatus: Project['statusV2'],
    projectManagerId: string | null,
    activeParticipantEmployeeIds: string[],
    actor: ProjectsActorContext,
  ): ProjectTaskView {
    const status = task.statusV2 ?? 'OPEN';
    const resolvedProjectStatus = projectStatus ?? 'DRAFT';
    return {
      id: task.id,
      version: task.version,
      projectId: task.projectId,
      stageId: task.stageId,
      taskCode: task.taskCode,
      taskName: task.taskName,
      description: task.description,
      parentTaskId: task.parentTaskId,
      priority: task.priority,
      plannedHours: decimalToString(task.plannedHours),
      completionPercentage: decimalToString(task.completionPercentage),
      status,
      startDate: dateToIso(task.startDate),
      dueDate: dateToIso(task.dueDate),
      activeParticipantEmployeeIds,
      allowedActions: computeProjectTaskAllowedActions({
        projectStatus: resolvedProjectStatus,
        taskStatus: status,
        projectManagerId,
        activeParticipantEmployeeIds,
        actor,
      }),
      actionRequirements: { expectedVersion: task.version },
    };
  }

  private toTaskDetail(
    task: ProjectTask & {
      participants: Array<{ employeeId: string }>;
      submissions: Array<{
        id: string;
        version: number;
        versionNo: number;
        submissionNotes: string | null;
        status: string;
        statusV2: import('@prisma/client').TaskSubmissionStatus | null;
        submittedById: string;
        submittedAt: Date;
        reviews: Array<{
          id: string;
          version: number;
          reviewerId: string;
          decision: string;
          decisionV2: import('@prisma/client').TaskReviewDecision | null;
          comments: string | null;
          reviewRound: number;
          reviewedAt: Date;
        }>;
        documents: Array<{
          id: string;
          taskSubmissionId: string | null;
          documentPurpose: string;
          title: string | null;
          uploadedAt: Date;
        }>;
      }>;
      assignmentHistory: Array<{
        id: string;
        employeeId: string;
        previousEmployeeId: string | null;
        role: string;
        action: string;
        remarks: string | null;
        createdAt: Date;
      }>;
      documents: Array<{
        id: string;
        taskSubmissionId: string | null;
        documentPurpose: string;
        title: string | null;
        uploadedAt: Date;
      }>;
    },
    projectStatus: Project['statusV2'],
    projectManagerId: string | null,
    actor: ProjectsActorContext,
  ) {
    const documentView = (document: {
      id: string;
      taskSubmissionId: string | null;
      documentPurpose: string;
      title: string | null;
      uploadedAt: Date;
    }) => ({
      id: document.id,
      taskSubmissionId: document.taskSubmissionId,
      documentPurpose: document.documentPurpose,
      title: document.title,
      uploadedAt: document.uploadedAt.toISOString(),
    });

    return {
      ...this.toTaskView(
        task,
        projectStatus,
        projectManagerId,
        task.participants.map((participant) => participant.employeeId),
        actor,
      ),
      submissions: task.submissions.map((submission) => ({
        id: submission.id,
        version: submission.version,
        versionNo: submission.versionNo,
        submissionNotes: submission.submissionNotes,
        status: submission.statusV2 ?? submission.status,
        submittedById: submission.submittedById,
        submittedAt: submission.submittedAt.toISOString(),
        reviews: submission.reviews.map((review) => ({
          id: review.id,
          version: review.version,
          reviewerId: review.reviewerId,
          decision: review.decisionV2 ?? review.decision,
          comments: review.comments,
          reviewRound: review.reviewRound,
          reviewedAt: review.reviewedAt.toISOString(),
        })),
        documents: submission.documents.map(documentView),
      })),
      assignmentHistory: task.assignmentHistory.map((event) => ({
        ...event,
        createdAt: event.createdAt.toISOString(),
      })),
      documents: task.documents.map(documentView),
    };
  }
}
