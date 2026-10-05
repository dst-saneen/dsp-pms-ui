import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsQueryService } from './services/projects-query.service';

@ApiTags('My Project Tasks')
@Controller('me/project-tasks')
@UseGuards(ProjectsEnabledGuard)
export class ProjectMeTasksController {
  constructor(
    private readonly query: ProjectsQueryService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  @ApiOperation({ summary: 'List my active project task assignments' })
  list(@Req() request: AuthenticatedRequest) {
    return this.query.listMyTasks(this.actors.resolve(request.user));
  }

  @Get(':taskId')
  @RequirePermissions(PROJECTS_PERMISSIONS.TASKS_WORK)
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.query.getMyTask(taskId, this.actors.resolve(request.user));
  }
}
