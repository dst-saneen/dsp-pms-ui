import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PROJECTS_PERMISSIONS } from './constants/projects-permissions';
import {
  CreateProjectUploadSessionDto,
  LinkProjectAttachmentDto,
} from './dto/project-attachment.dto';
import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectDocumentService } from './services/project-document.service';

@ApiTags('Projects - Attachments')
@Controller('projects/:id')
@UseGuards(ProjectsEnabledGuard)
export class ProjectAttachmentsController {
  constructor(
    private readonly documents: ProjectDocumentService,
    private readonly actors: ProjectsActorContextService,
  ) {}

  @Post('upload-sessions')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({ summary: 'Create a project file upload session' })
  createUploadSession(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateProjectUploadSessionDto,
  ) {
    return this.documents.createProjectUploadSession(
      projectId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post('attachments')
  @RequirePermissions(PROJECTS_PERMISSIONS.MANAGE)
  @ApiOperation({
    summary: 'Link a CLEAN upload session as a project attachment',
  })
  linkAttachment(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Body() dto: LinkProjectAttachmentDto,
  ) {
    return this.documents.linkProjectAttachment(
      projectId,
      dto,
      this.actors.resolve(request.user),
    );
  }

  @Post('attachments/:attachmentId/download-grant')
  @RequirePermissions(PROJECTS_PERMISSIONS.READ)
  @ApiOperation({
    summary: 'Grant a short-lived download URL for a project attachment',
  })
  downloadGrant(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) projectId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
  ) {
    return this.documents.downloadGrant(
      projectId,
      attachmentId,
      this.actors.resolve(request.user),
    );
  }
}
