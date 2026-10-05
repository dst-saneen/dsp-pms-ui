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

import {
  ApproveOvertimeRequestDto,
  CancelOvertimeRequestDto,
  OvertimeRequestFilterDto,
  RejectOvertimeRequestDto,
  SubmitOvertimeRequestDto,
} from './dto';
import { OvertimeRequestService } from './overtime-request.service';

@ApiTags('Overtime Requests')
@Controller('overtime-requests')
export class OvertimeRequestController {
  constructor(
    private readonly overtimeRequestService: OvertimeRequestService,
  ) {}

  @Get()
  @RequirePermissions('hr.overtime.read')
  findAll(@Query() filters: OvertimeRequestFilterDto) {
    return this.overtimeRequestService.findAll(filters);
  }

  @Get(':id')
  @RequirePermissions('hr.overtime.read')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.overtimeRequestService.findOne(id);
  }

  @Post(':id/submit')
  @RequirePermissions('hr.overtime.manage')
  submit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitOvertimeRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.overtimeRequestService.submit(id, dto, request.user);
  }

  @Post(':id/approve')
  @RequireAnyPermissions('hr.overtime.approve', 'hr.team.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveOvertimeRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.overtimeRequestService.approve(id, dto, request.user);
  }

  @Post(':id/reject')
  @RequireAnyPermissions('hr.overtime.approve', 'hr.team.approve')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectOvertimeRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.overtimeRequestService.reject(id, dto, request.user);
  }

  @Post(':id/cancel')
  @RequirePermissions('hr.overtime.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelOvertimeRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.overtimeRequestService.cancel(id, dto, request.user);
  }
}
