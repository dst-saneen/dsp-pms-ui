import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import { ProjectCommandDto } from './dto/project-command.dto';
import { SearchTimesheetsDto } from './dto/timesheet.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectTimesheetCommandService } from './services/project-timesheet-command.service';
import { ProjectTimesheetQueryService } from './services/project-timesheet-query.service';

@ApiTags('Team Timesheets')
@Controller('team/timesheets')
@UseGuards(ProjectsEnabledGuard)
export class ProjectTeamTimesheetsController {
  constructor(
    private readonly query: ProjectTimesheetQueryService,
    private readonly commands: ProjectTimesheetCommandService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE)
  @ApiOperation({ summary: 'List timesheets pending my approval' })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchTimesheetsDto,
  ) {
    return this.query.listTeam(this.actors.resolve(request.user), query);
  }

  @Get(':id')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE)
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.getTeam(id, this.actors.resolve(request.user));
  }

  @Post(':id/approve')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE)
  approve(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.approve(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/return')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_APPROVE)
  returnTimesheet(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.returnTimesheet(
      id,
      dto,
      this.actors.resolve(request.user),
    );
  }
}
