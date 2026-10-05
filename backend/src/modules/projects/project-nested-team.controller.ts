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
  AddProjectTeamMemberDto,
  EndProjectTeamMemberDto,
  UpdateProjectTeamMemberDto,
} from './dto/project-team.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectEligibilityService } from './services/project-eligibility.service';
import { ProjectTeamCommandService } from './services/project-team-command.service';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsQueryService } from './services/projects-query.service';

@ApiTags('Projects - Team')
@Controller('projects/:id')
@UseGuards(ProjectsEnabledGuard)
export class ProjectNestedTeamController {
  constructor(
    private readonly query: ProjectsQueryService,
    private readonly commands: ProjectTeamCommandService,
    private readonly eligibility: ProjectEligibilityService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Get('team')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({ summary: 'List project team members' })
  listTeam(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
  ) {
    return this.query.listTeam(projectId, this.actors.resolve(request.user));
  }

  @Post('team')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  addMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: AddProjectTeamMemberDto,
  ) {
    return this.commands.add(projectId, dto, this.actors.resolve(request.user));
  }

  @Patch('team/:memberId')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  updateMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateProjectTeamMemberDto,
  ) {
    return this.commands.update(
      projectId,
      memberId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post('team/:memberId/end')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  endMember(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: EndProjectTeamMemberDto,
  ) {
    return this.commands.end(
      projectId,
      memberId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Get('member-candidates')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Eligible employees for project team' })
  memberCandidates(
    @Param('id', ParseUUIDPipe) projectId: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.eligibility.memberCandidates(projectId, keyword);
  }
}
