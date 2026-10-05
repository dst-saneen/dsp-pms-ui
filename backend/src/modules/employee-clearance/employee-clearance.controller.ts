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

import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth';

import { EmployeeClearanceService } from './employee-clearance.service';
import { ClearanceItemActionDto } from './dto/clearance-item-action.dto';
import { ListEmployeeClearanceDto } from './dto/list-employee-clearance.dto';

@ApiTags('Employee Clearance')
@Controller()
export class EmployeeClearanceController {
  constructor(private readonly service: EmployeeClearanceService) {}

  @Get('employee-clearances')
  @RequireAnyPermissions(
    'hr.clearance.department.read',
    'hr.clearance.department.manage',
    'hr.employees.read',
    'hr.employees.manage',
  )
  findAll(
    @Query() query: ListEmployeeClearanceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findAll(query, request.user);
  }

  @Post('employee-clearance-items/:itemId/clear')
  @RequireAnyPermissions(
    'hr.clearance.department.manage',
    'hr.employees.manage',
  )
  clear(
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: ClearanceItemActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.clear(itemId, dto, request.user);
  }

  @Post('employee-clearance-items/:itemId/reopen')
  @RequireAnyPermissions(
    'hr.clearance.department.manage',
    'hr.employees.manage',
  )
  reopen(
    @Param('itemId', new ParseUUIDPipe()) itemId: string,
    @Body() dto: ClearanceItemActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reopen(itemId, dto, request.user);
  }
}
