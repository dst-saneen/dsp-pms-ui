import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import { ProjectCommandDto } from './dto/project-command.dto';
import {
  AssignProjectTaskDto,
  CreateProjectTaskDto,
  UnassignProjectTaskDto,
  UpdateProjectTaskDto,
} from './dto/project-task.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectEligibilityService } from './services/project-eligibility.service';
import { ProjectDocumentService } from './services/project-document.service';
import { ProjectTaskCommandService } from './services/project-task-command.service';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsQueryService } from './services/projects-query.service';
import {
  CreateProjectUploadSessionDto,
  LinkProjectAttachmentDto,
} from './dto/project-attachment.dto';

@ApiTags('Projects - Tasks')
@Controller('projects/:projectId/tasks')
@UseGuards(ProjectsEnabledGuard)
export class ProjectNestedTasksController {
  constructor(
    private readonly query: ProjectsQueryService,
    private readonly commands: ProjectTaskCommandService,
    private readonly eligibility: ProjectEligibilityService,
    private readonly documents: ProjectDocumentService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List project tasks' })
  list(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.query.listTasks(projectId, this.actors.resolve(request.user));
  }

  @Post()
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  create(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectTaskDto,
  ) {
    return this.commands.create(
      projectId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Get(':taskId')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.query.getTask(
      projectId,
      taskId,
      this.actors.resolve(request.user),
    );
  }

  @Patch(':taskId')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateProjectTaskDto,
  ) {
    return this.commands.update(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Get(':taskId/assignee-candidates')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  assigneeCandidates(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.eligibility.assigneeCandidates(projectId, taskId, keyword);
  }

  @Post(':taskId/assign')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  assign(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignProjectTaskDto,
  ) {
    return this.commands.assign(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/reassign')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  reassign(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: AssignProjectTaskDto,
  ) {
    return this.commands.reassign(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/unassign')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  unassign(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UnassignProjectTaskDto,
  ) {
    return this.commands.unassign(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/start')
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  start(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.start(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/submit-review')
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  submitReview(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.submitReview(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/return')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  returnTask(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.returnTask(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/complete')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.complete(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/cancel')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.cancel(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/upload-sessions')
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  createUploadSession(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateProjectUploadSessionDto,
  ) {
    return this.documents.createTaskUploadSession(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/attachments')
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  linkAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: LinkProjectAttachmentDto,
  ) {
    return this.documents.linkTaskAttachment(
      projectId,
      taskId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':taskId/attachments/:attachmentId/download-grant')
  @RequireAnyPermissions(
    PROJECTS_PERMISSIONS.READ,
    PROJECTS_PERMISSIONS.TASKS_WORK,
  )
  downloadGrant(
    @Req() request: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.documents.downloadTaskGrant(
      projectId,
      taskId,
      attachmentId,
      this.actors.resolve(request.user),
    );
  }
}
