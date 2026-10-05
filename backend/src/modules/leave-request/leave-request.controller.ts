import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { CancelLeaveRequestDto } from './dto/cancel-leave-request.dto';
import { CreateLeaveRequestDto } from './dto/create-leave-request.dto';
import { LeaveApprovalQueueQueryDto } from './dto/leave-approval-queue.dto';
import { LeaveRequestFilterDto } from './dto/leave-request-filter.dto';
import {
  ProcessLeaveRequestDto,
  RejectLeaveRequestDto,
} from './dto/process-leave-request.dto';
import { UpdateLeaveRequestDto } from './dto/update-leave-request.dto';
import { LeaveRequestService } from './leave-request.service';

@ApiTags('Leave Request')
@Controller('leave-requests')
export class LeaveRequestController {
  constructor(private readonly leaveRequestService: LeaveRequestService) {}

  @Post()
  create(@Body() dto: CreateLeaveRequestDto) {
    return this.leaveRequestService.create(dto);
  }

  @Get()
  @RequireAnyPermissions('hr.leave.read', 'hr.team.approve')
  findAll(
    @Query() filters: LeaveRequestFilterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaveRequestService.findAll(filters, request.user);
  }

  @Get('pending-approvals')
  @RequireAnyPermissions('hr.leave.read', 'hr.team.approve')
  getPendingApprovals(
    @Req() request: AuthenticatedRequest,
    @Query() query: LeaveApprovalQueueQueryDto,
  ) {
    return this.leaveRequestService.getPendingApprovalsForActor(
      request.user,
      query.queue ?? 'actionable',
    );
  }

  /** @deprecated Use GET /leave-requests/pending-approvals */
  @Get('pending-approvals/:approverId')
  @RequireAnyPermissions('hr.leave.read', 'hr.team.approve')
  getPendingApprovalsLegacy(
    @Param('approverId') approverId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaveRequestService.getPendingApprovals(
      approverId,
      request.user,
    );
  }

  @Get(':id')
  @RequireAnyPermissions('hr.leave.read', 'hr.team.approve')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.leaveRequestService.findOne(id, request.user);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeaveRequestDto) {
    return this.leaveRequestService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.leaveRequestService.remove(id, request.user);
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.leaveRequestService.submit(id, request.user);
  }

  @Post(':id/approve')
  @RequireAnyPermissions('hr.leave.manage', 'hr.team.approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ProcessLeaveRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaveRequestService.approve(id, dto, request.user);
  }

  @Post(':id/reject')
  @RequireAnyPermissions('hr.leave.manage', 'hr.team.approve')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaveRequestService.reject(id, dto, request.user);
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelLeaveRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.leaveRequestService.cancel(id, dto, request.user);
  }
}
