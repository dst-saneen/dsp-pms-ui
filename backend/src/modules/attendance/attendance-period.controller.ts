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

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { AttendancePeriodService } from './attendance-period.service';
import {
  AttendancePeriodFilterDto,
  AttendancePeriodTransitionDto,
  CreateAttendancePeriodDto,
} from './dto/attendance-workforce.dto';

@ApiTags('Attendance Periods')
@Controller('attendance-periods')
export class AttendancePeriodController {
  constructor(
    private readonly attendancePeriodService: AttendancePeriodService,
  ) {}

  @Post()
  @RequirePermissions('hr.attendance.lock')
  create(
    @Body() dto: CreateAttendancePeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.create(dto, request.user);
  }

  @Get()
  findAll(@Query() filters: AttendancePeriodFilterDto) {
    return this.attendancePeriodService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendancePeriodService.findOne(id);
  }

  @Post(':id/review')
  @RequirePermissions('hr.attendance.lock')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendancePeriodTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.review(id, dto, request.user);
  }

  @Post(':id/lock')
  @RequirePermissions('hr.attendance.lock')
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendancePeriodTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.lock(id, dto, request.user);
  }

  @Post(':id/mark-payroll-pending')
  @RequirePermissions('hr.attendance.lock')
  markPayrollPending(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendancePeriodTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.markPayrollPending(
      id,
      dto,
      request.user,
    );
  }

  @Post(':id/close')
  @RequirePermissions('hr.attendance.lock')
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendancePeriodTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.close(id, dto, request.user);
  }

  @Post(':id/reopen')
  @RequirePermissions('hr.attendance.lock')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AttendancePeriodTransitionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendancePeriodService.reopen(id, dto, request.user);
  }
}
