import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import { ProjectCommandDto } from './dto/project-command.dto';
import {
  CreateProjectStageDto,
  UpdateProjectStageDto,
} from './dto/project-stage.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectStageCommandService } from './services/project-stage-command.service';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsQueryService } from './services/projects-query.service';

@ApiTags('Projects - Stages')
@Controller('projects/:id/stages')
@UseGuards(ProjectsEnabledGuard)
export class ProjectNestedStagesController {
  constructor(
    private readonly query: ProjectsQueryService,
    private readonly commands: ProjectStageCommandService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List project stages' })
  list(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    return this.query.listStages(projectId, this.actors.resolve(request.user));
  }

  @Post()
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  create(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectStageDto,
  ) {
    return this.commands.create(
      projectId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Patch(':stageId')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: UpdateProjectStageDto,
  ) {
    return this.commands.update(
      projectId,
      stageId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':stageId/activate')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  activate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.activate(
      projectId,
      stageId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':stageId/complete')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.complete(
      projectId,
      stageId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':stageId/cancel')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('stageId', ParseUUIDPipe) stageId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.cancel(
      projectId,
      stageId,
      dto,
      this.actors.resolve(request.user),
    );
  }
}
