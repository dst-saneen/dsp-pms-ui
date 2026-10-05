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

import { EmployeeSeparationService } from './employee-separation.service';
import { CancelSeparationDto } from './dto/cancel-separation.dto';
import { CompleteSeparationDto } from './dto/complete-separation.dto';
import { CreateEmployeeSeparationDto } from './dto/create-employee-separation.dto';
import { ListPendingSeparationApprovalsDto } from './dto/list-pending-separation-approvals.dto';
import { ProcessSeparationDto } from './dto/process-separation.dto';
import { SeparationFilterDto } from './dto/separation-filter.dto';

@ApiTags('Employee Separations')
@Controller('employee-separations')
export class EmployeeSeparationController {
  constructor(private readonly service: EmployeeSeparationService) {}

  @Post()
  @RequirePermissions('hr.employees.manage')
  create(
    @Body() dto: CreateEmployeeSeparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, request.user);
  }

  @Get('clearance-department-candidates')
  @RequirePermissions('hr.employees.manage')
  findClearanceDepartmentCandidates(
    @Query('employeeId', new ParseUUIDPipe()) employeeId: string,
  ) {
    return this.service.findClearanceDepartmentCandidates(employeeId);
  }

  @Get('pending-approvals')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.employees.read',
    'hr.employees.manage',
  )
  pendingApprovals(
    @Query() filters: ListPendingSeparationApprovalsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.pendingApprovals(request.user, filters);
  }

  @Get()
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.employees.read',
    'hr.employees.manage',
  )
  findAll(
    @Query() filters: SeparationFilterDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findAll(filters, request.user);
  }

  @Get(':id')
  @RequireAnyPermissions(
    'hr.self.read',
    'hr.employees.read',
    'hr.employees.manage',
  )
  findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, request.user);
  }

  @Post(':id/approve')
  @RequireAnyPermissions('hr.self.read', 'hr.employees.manage')
  approve(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ProcessSeparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.approve(id, dto, request.user);
  }

  @Post(':id/reject')
  @RequireAnyPermissions('hr.self.read', 'hr.employees.manage')
  reject(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ProcessSeparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reject(id, dto, request.user);
  }

  @Post(':id/cancel')
  @RequireAnyPermissions('hr.self.read', 'hr.employees.manage')
  cancel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CancelSeparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.cancel(id, dto, request.user);
  }

  @Post(':id/complete')
  @RequirePermissions('hr.employees.manage')
  complete(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteSeparationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.complete(id, dto, request.user);
  }
}
