import { ForbiddenException, Injectable } from '@nestjs/common';
import { FileUploadPurpose, Prisma } from '@prisma/client';

import {
  DomainConflictException,
  DomainNotFoundException,
  getRequestId,
} from '../../../common';
import { FileDownloadService } from '../../file-storage/services/file-download.service';
import { FileUploadSessionService } from '../../file-storage/services/file-upload-session.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { PROJECTS_ERROR_CODES } from '../constants/projects-error-codes';
import type {
  CreateProjectUploadSessionDto,
  LinkProjectAttachmentDto,
} from '../dto/project-attachment.dto';
import type { ProjectsActorContext } from '../types/project.types';
import { ProjectCommandReceiptService } from './project-command-receipt.service';
import { ProjectsDomainScopeService } from './projects-domain-scope.service';
import { ProjectsFeatureGateService } from './projects-feature-gate.service';

@Injectable()
export class ProjectDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: ProjectsDomainScopeService,
    private readonly gate: ProjectsFeatureGateService,
    private readonly uploadSessions: FileUploadSessionService,
    private readonly downloads: FileDownloadService,
    private readonly receipts: ProjectCommandReceiptService,
  ) {}

  async createProjectUploadSession(
    projectId: string,
    dto: CreateProjectUploadSessionDto,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    this.scope.assertConfigurationAuthority(project, actor);

    return this.uploadSessions.createSession({
      companyId: project.companyId,
      branchId: project.branchId,
      purpose: FileUploadPurpose.PROJECT_SUPPORTING,
      projectId: project.id,
      fileName: dto.fileName,
      declaredMimeType: dto.declaredMimeType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256,
      operationId: dto.operationId,
      creatorUserId: actor.userId,
    });
  }

  async createTaskUploadSession(
    projectId: string,
    taskId: string,
    dto: CreateProjectUploadSessionDto,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    this.scope.assertActiveWorkAuthority(project, actor, false);
    await this.assertTaskEvidenceActor(
      this.prisma,
      project.companyId,
      projectId,
      taskId,
      actor,
      false,
    );

    return this.uploadSessions.createSession({
      companyId: project.companyId,
      branchId: project.branchId,
      purpose: FileUploadPurpose.PROJECT_SUPPORTING,
      projectId: project.id,
      taskId,
      fileName: dto.fileName,
      declaredMimeType: dto.declaredMimeType,
      sizeBytes: dto.sizeBytes,
      checksumSha256: dto.checksumSha256,
      operationId: dto.operationId,
      creatorUserId: actor.userId,
    });
  }

  async linkProjectAttachment(
    projectId: string,
    dto: LinkProjectAttachmentDto,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    this.scope.assertConfigurationAuthority(project, actor);

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_ATTACHMENT_LINK',
      operationId: dto.operationId,
      requestPayload: { projectId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertConfigurationAuthority(currentProject, actor);
        const session = await this.requireCleanProjectSession(
          dto.uploadSessionId,
          project.companyId,
          projectId,
          undefined,
        );

        const created = await tx.projectDocument.create({
          data: {
            companyId: project.companyId,
            projectId,
            fileObjectId: session.fileObjectId!,
            documentPurpose:
              dto.documentPurpose?.trim() || 'PROJECT_SUPPORTING',
            title: dto.title?.trim() || session.expectedFileName,
            uploadedByUserId: actor.userId,
          },
        });

        const view = this.toView(created);
        return {
          entityType: 'PROJECT_DOCUMENT',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async linkTaskAttachment(
    projectId: string,
    taskId: string,
    dto: LinkProjectAttachmentDto,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    this.scope.assertActiveWorkAuthority(project, actor, false);
    await this.assertTaskEvidenceActor(
      this.prisma,
      project.companyId,
      projectId,
      taskId,
      actor,
      false,
    );

    return this.receipts.claimOrReplay({
      companyId: project.companyId,
      commandType: 'PROJECT_TASK_ATTACHMENT_LINK',
      operationId: dto.operationId,
      requestPayload: { projectId, taskId, ...dto },
      execute: async (tx) => {
        const currentProject = await this.scope.lockProjectInTx(
          tx,
          projectId,
          project.companyId,
        );
        this.scope.assertActiveWorkAuthority(currentProject, actor, false);
        await this.assertTaskEvidenceActor(
          tx,
          currentProject.companyId,
          projectId,
          taskId,
          actor,
          false,
        );
        const session = await this.requireCleanProjectSession(
          dto.uploadSessionId,
          project.companyId,
          projectId,
          taskId,
        );

        const created = await tx.projectDocument.create({
          data: {
            companyId: project.companyId,
            projectId,
            taskId,
            fileObjectId: session.fileObjectId!,
            documentPurpose:
              dto.documentPurpose?.trim() || 'PROJECT_SUPPORTING',
            title: dto.title?.trim() || session.expectedFileName,
            uploadedByUserId: actor.userId,
          },
        });

        const view = this.toView(created);
        return {
          entityType: 'PROJECT_DOCUMENT',
          entityId: created.id,
          snapshot: view as unknown as Prisma.InputJsonValue,
          result: view,
        };
      },
    });
  }

  async downloadGrant(
    projectId: string,
    attachmentId: string,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);

    try {
      return await this.downloads.grantProjectDocumentDownload(
        attachmentId,
        project.companyId,
        projectId,
        actor.userId,
        getRequestId(),
      );
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { code?: string } }).response?.code
          : undefined;
      if (
        code === 'FILE_NOT_CLEAN' ||
        code === 'FILE_SCAN_PENDING' ||
        code === 'FILE_INFECTED' ||
        code === 'FILE_SCAN_FAILED'
      ) {
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.PROJECT_FILE_NOT_CLEAN,
          'Project file is not available for download.',
        );
      }
      throw error;
    }
  }

  async downloadTaskGrant(
    projectId: string,
    taskId: string,
    attachmentId: string,
    actor: ProjectsActorContext,
  ) {
    const project = await this.scope.requireProject(projectId);
    await this.gate.assertEnabledForContext(project.companyId);
    await this.assertTaskEvidenceActor(
      this.prisma,
      project.companyId,
      projectId,
      taskId,
      actor,
      true,
    );
    const attachment = await this.prisma.projectDocument.findFirst({
      where: {
        id: attachmentId,
        companyId: project.companyId,
        projectId,
        taskId,
      },
      select: { id: true },
    });
    if (!attachment) {
      throw new DomainNotFoundException(
        PROJECTS_ERROR_CODES.PROJECT_DOCUMENT_NOT_FOUND,
        'Project task document not found',
      );
    }
    return this.downloadGrant(projectId, attachmentId, actor);
  }

  private async requireCleanProjectSession(
    sessionId: string,
    companyId: string,
    projectId: string,
    taskId?: string,
  ) {
    try {
      return await this.uploadSessions.requireCleanSession({
        sessionId,
        companyId,
        purpose: FileUploadPurpose.PROJECT_SUPPORTING,
        projectId,
        taskId,
      });
    } catch (error) {
      const code =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { code?: string } }).response?.code
          : undefined;
      if (code === 'FILE_NOT_CLEAN' || code === 'FILE_SCAN_PENDING') {
        throw new DomainConflictException(
          PROJECTS_ERROR_CODES.PROJECT_FILE_NOT_CLEAN,
          'Upload session file is not CLEAN yet.',
        );
      }
      throw error;
    }
  }

  private async assertTaskEvidenceActor(
    db: PrismaService | Prisma.TransactionClient,
    companyId: string,
    projectId: string,
    taskId: string,
    actor: ProjectsActorContext,
    allowProjectManager: boolean,
  ) {
    const task = await db.projectTask.findFirst({
      where: {
        id: taskId,
        projectId,
        companyId,
        ...(allowProjectManager && actor.employeeId
          ? {
              OR: [
                { project: { projectManagerId: actor.employeeId } },
                {
                  participants: {
                    some: {
                      employeeId: actor.employeeId,
                      statusV2: 'ACTIVE',
                    },
                  },
                },
              ],
            }
          : actor.employeeId
            ? {
                participants: {
                  some: {
                    employeeId: actor.employeeId,
                    statusV2: 'ACTIVE',
                  },
                },
              }
            : { id: '__no_employee_actor__' }),
      },
      select: { id: true },
    });
    if (!task) {
      throw new ForbiddenException({
        code: PROJECTS_ERROR_CODES.PROJECT_EVIDENCE_NOT_ALLOWED,
        message: allowProjectManager
          ? 'Only an active task assignee or the current Project Manager may access task evidence.'
          : 'Only an active task assignee may attach task evidence.',
      });
    }
  }

  private toView(doc: {
    id: string;
    projectId: string;
    taskId: string | null;
    fileObjectId: string;
    documentPurpose: string;
    title: string | null;
    uploadedByUserId: string;
    uploadedAt: Date;
  }) {
    return {
      id: doc.id,
      projectId: doc.projectId,
      taskId: doc.taskId,
      fileObjectId: doc.fileObjectId,
      documentPurpose: doc.documentPurpose,
      title: doc.title,
      uploadedByUserId: doc.uploadedByUserId,
      uploadedAt: doc.uploadedAt.toISOString(),
    };
  }
}
