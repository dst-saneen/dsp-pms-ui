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

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import { ProjectCommandDto } from './dto/project-command.dto';
import {
  AddTimesheetLineDto,
  CreateTimesheetDto,
  SearchTimesheetsDto,
  UpdateTimesheetDto,
  UpdateTimesheetLineDto,
} from './dto/timesheet.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectTimesheetCommandService } from './services/project-timesheet-command.service';
import { ProjectTimesheetQueryService } from './services/project-timesheet-query.service';

@ApiTags('My Timesheets')
@Controller('me/timesheets')
@UseGuards(ProjectsEnabledGuard)
export class ProjectMeTimesheetsController {
  constructor(
    private readonly query: ProjectTimesheetQueryService,
    private readonly commands: ProjectTimesheetCommandService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  @ApiOperation({ summary: 'List my timesheets' })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchTimesheetsDto,
  ) {
    return this.query.listMine(this.actors.resolve(request.user), query);
  }

  @Post()
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  @ApiOperation({
    summary: 'Create a weekly timesheet for the current employee',
  })
  create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateTimesheetDto,
  ) {
    return this.commands.create(dto, this.actors.resolve(request.user));
  }

  @Get(':id')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.getMine(id, this.actors.resolve(request.user));
  }

  @Patch(':id')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimesheetDto,
  ) {
    return this.commands.update(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/lines')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  addLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddTimesheetLineDto,
  ) {
    return this.commands.addLine(id, dto, this.actors.resolve(request.user));
  }

  @Patch(':id/lines/:lineId')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  updateLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: UpdateTimesheetLineDto,
  ) {
    return this.commands.updateLine(
      id,
      lineId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':id/lines/:lineId/remove')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  removeLine(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.removeLine(
      id,
      lineId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post(':id/submit')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  submit(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.submit(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/cancel')
  @RequirePermissions(PROJECTS_PERMISSIONS.TIMESHEETS_SUBMIT)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.commands.cancel(id, dto, this.actors.resolve(request.user));
  }
}
