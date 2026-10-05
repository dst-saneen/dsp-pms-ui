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
import {
  CreateProjectDto,
  SearchProjectsDto,
  UpdateProjectDto,
} from './dto/create-project.dto';
import { ProjectCommandDto } from './dto/project-command.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectEligibilityService } from './services/project-eligibility.service';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsDomainScopeService } from './services/projects-domain-scope.service';
import { ProjectsLifecycleService } from './services/projects-lifecycle.service';
import { ProjectsQueryService } from './services/projects-query.service';
import { ProjectSummaryService } from './services/project-summary.service';
import { ProjectsWorkspaceCapabilitiesService } from './services/projects-workspace-capabilities.service';

@ApiTags('Projects')
@Controller('projects')
@UseGuards(ProjectsEnabledGuard)
export class ProjectsController {
  constructor(
    private readonly query: ProjectsQueryService,
    private readonly lifecycle: ProjectsLifecycleService,
    private readonly summary: ProjectSummaryService,
    private readonly actors: ProjectsActorContextService,
    private readonly capabilities: ProjectsWorkspaceCapabilitiesService,
    private readonly eligibility: ProjectEligibilityService,
    private readonly scope: ProjectsDomainScopeService,
  ) {}

  @Get('workspace-capabilities')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Workspace capability flags for Projects UI' })
  workspaceCapabilities(@Req() request: AuthenticatedRequest) {
    return this.capabilities.getCapabilities(this.actors.resolve(request.user));
  }

  @Get('manager-candidates')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({
    summary: 'Eligible Project Manager candidates for the active company',
  })
  managerCandidates(@Query('keyword') keyword?: string) {
    const companyId = this.scope.requireCompanyId();
    return this.eligibility.managerCandidates(companyId, keyword);
  }

  @Get('business-party-candidates')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({
    summary: 'Active customer candidates scoped to the Project Company',
  })
  businessPartyCandidates(@Query('keyword') keyword?: string) {
    const companyId = this.scope.requireCompanyId();
    return this.eligibility.businessPartyCandidates(companyId, keyword);
  }

  @Get()
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List projects' })
  list(
    @Req() request: AuthenticatedRequest,
    @Query() query: SearchProjectsDto,
  ) {
    return this.query.listProjects(this.actors.resolve(request.user), query);
  }

  @Post()
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Create project' })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateProjectDto) {
    return this.lifecycle.create(dto, this.actors.resolve(request.user));
  }

  @Get(':id/activation-preflight')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Activation preconditions for a project' })
  activationPreflight(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lifecycle.getActivationPreflight(
      id,
      this.actors.resolve(request.user),
    );
  }

  @Get(':id/summary')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Project operational summary' })
  getSummary(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.summary.getSummary(id, this.actors.resolve(request.user));
  }

  @Get(':id/time-summary')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Approved time totals for the project' })
  getTimeSummary(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.summary.getTimeSummary(id, this.actors.resolve(request.user));
  }

  @Get(':id/finance-summary')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({
    summary:
      'Operational cash summary (enabled when Office Finance is available)',
  })
  getFinanceSummary(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.summary.getFinanceSummary(
      id,
      this.actors.resolve(request.user),
    );
  }

  @Get(':id')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'Get project by id' })
  getOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.query.getProject(id, this.actors.resolve(request.user));
  }

  @Patch(':id')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Update project draft/active fields' })
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.lifecycle.update(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/activate')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  activate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.activate(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/hold')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  hold(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.hold(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/resume')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  resume(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.resume(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/complete')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  complete(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.complete(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/cancel')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  cancel(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.cancel(id, dto, this.actors.resolve(request.user));
  }

  @Post(':id/archive')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProjectCommandDto,
  ) {
    return this.lifecycle.archive(id, dto, this.actors.resolve(request.user));
  }
}
