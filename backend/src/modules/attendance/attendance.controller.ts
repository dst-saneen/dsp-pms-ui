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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';

import { AttendanceFinalizerService } from './attendance-finalizer.service';
import { AttendanceRegularizationService } from './attendance-regularization.service';
import { AttendanceService } from './attendance.service';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import {
  AttendanceExceptionFilterDto,
  CreateAttendanceRegularizationDto,
  ProcessAttendanceRegularizationDto,
} from './dto/attendance-workforce.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { CorrectAttendanceDto } from './dto/correct-attendance.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@ApiTags('Attendance')
@Controller('attendance')
export class AttendanceController {
  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly attendanceRegularizationService: AttendanceRegularizationService,
    private readonly attendanceFinalizerService: AttendanceFinalizerService,
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateAttendanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceService.create(dto, request.user);
  }

  @Get()
  findAll(@Query() filters: AttendanceFilterDto) {
    return this.attendanceService.findAll(filters);
  }

  @Get('exceptions')
  findExceptions(@Query() filters: AttendanceExceptionFilterDto) {
    const where: Record<string, unknown> = {
      ...this.employeeDomainScope.attendanceExceptionWhere(),
    };
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;

    return this.prisma.attendanceException.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
        attendance: true,
      },
      orderBy: [{ businessDate: 'desc' }, { detectedAt: 'desc' }],
    });
  }

  @Get('exceptions/:id')
  async findException(@Param('id', ParseUUIDPipe) id: string) {
    const row = await this.prisma.attendanceException.findFirst({
      where: {
        id,
        ...this.employeeDomainScope.attendanceExceptionWhere(),
      },
      include: { attendance: true, employee: true },
    });
    if (!row) {
      this.employeeDomainScope.notFound('Attendance exception');
    }
    return row;
  }

  @Get('regularizations')
  findRegularizations(
    @Query() filters: { employeeId?: string; status?: string },
  ) {
    return this.attendanceRegularizationService.findAll(filters);
  }

  @Post('regularizations')
  @RequirePermissions('hr.attendance.regularize')
  createRegularization(
    @Body() dto: CreateAttendanceRegularizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceRegularizationService.submit(dto, request.user);
  }

  @Get('regularizations/:id')
  findRegularization(@Param('id', ParseUUIDPipe) id: string) {
    return this.attendanceRegularizationService.findOne(id);
  }

  @Post('regularizations/:id/approve')
  @RequireAnyPermissions('hr.attendance.regularize', 'hr.team.approve')
  approveRegularization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessAttendanceRegularizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceRegularizationService.approve(id, dto, request.user);
  }

  @Post('regularizations/:id/reject')
  @RequireAnyPermissions('hr.attendance.regularize', 'hr.team.approve')
  rejectRegularization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessAttendanceRegularizationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceRegularizationService.reject(id, dto, request.user);
  }

  @Post('regularizations/:id/cancel')
  cancelRegularization(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceRegularizationService.cancel(id, request.user);
  }

  /** Manual trigger for finalizer (jobs wire this in WP-07). */
  @Post('finalize-batch')
  @RequirePermissions('hr.attendance.manage')
  finalizeBatch() {
    return this.attendanceFinalizerService.finalizeBatch();
  }

  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.checkIn(dto, request.user);
  }

  @Post('check-out')
  checkOut(@Body() dto: CheckOutDto, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.checkOut(dto, request.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.attendanceService.findOne(id);
  }

  @Patch(':id/correct')
  @RequirePermissions('hr.attendance.manage')
  correct(
    @Param('id') id: string,
    @Body() dto: CorrectAttendanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.attendanceService.correct(id, dto, request.user);
  }
}
