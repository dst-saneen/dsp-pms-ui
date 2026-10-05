import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { CreateHrRequestDto } from './dto/create-hr-request.dto';
import { CreateHrRequestUploadSessionDto } from './dto/create-hr-request-upload-session.dto';
import {
  HrRequestReasonCommandDto,
  HrRequestVersionedCommandDto,
  RejectHrRequestDto,
} from './dto/hr-request-command.dto';
import { ListHrRequestsDto } from './dto/list-hr-requests.dto';
import { ListPendingHrApprovalsDto } from './dto/list-pending-hr-approvals.dto';
import { HrRequestService } from './hr-request.service';

@ApiTags('HR Requests')
@Controller('hr-requests')
export class HrRequestController {
  constructor(private readonly service: HrRequestService) {}

  @Post()
  @RequirePermissions('hr.self.read')
  create(
    @Body() dto: CreateHrRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, request.user);
  }

  @Get()
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.read',
    'hr.requests.manage',
  )
  findAll(
    @Query() query: ListHrRequestsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findAll(query, request.user);
  }

  @Post('upload-sessions')
  @RequirePermissions('hr.self.read')
  createUploadSession(
    @Body() dto: CreateHrRequestUploadSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createUploadSession(dto, request.user);
  }

  @Get('pending-approvals')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.approve',
    'hr.requests.manage',
  )
  pendingApprovals(
    @Query() query: ListPendingHrApprovalsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.pendingApprovals(request.user, query);
  }

  @Get(':id')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.read',
    'hr.requests.manage',
  )
  findOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, request.user);
  }

  @Post(':id/attachment/download-grant')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.read',
    'hr.requests.manage',
    'hr.requests.approve',
  )
  attachmentDownloadGrant(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createAttachmentDownloadGrant(
      id,
      request.user,
      request.headers['x-request-id'] as string | undefined,
    );
  }

  @Post(':id/approve')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.approve',
    'hr.requests.manage',
  )
  approve(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: HrRequestVersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.approve(id, dto, request.user);
  }

  @Post(':id/reject')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.requests.approve',
    'hr.requests.manage',
  )
  reject(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: RejectHrRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reject(id, dto, request.user);
  }

  @Post(':id/complete')
  @RequirePermissions('hr.requests.manage')
  complete(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: HrRequestVersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.complete(id, dto, request.user);
  }

  @Post(':id/cancel')
  @RequireAnyPermissions('hr.self.read', 'hr.requests.manage')
  cancel(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: HrRequestReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, request.user);
  }
}
