import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { EmployeeLeaveBalanceService } from './employee-leave-balance.service';
import { LeaveBalanceGenerationService } from './leave-balance-generation.service';

import { CreateEmployeeLeaveBalanceDto } from './dto/create-employee-leave-balance.dto';
import { DeactivateEmployeeLeaveBalanceDto } from './dto/deactivate-employee-leave-balance.dto';
import { UpdateEmployeeLeaveBalanceDto } from './dto/update-employee-leave-balance.dto';
import { EmployeeLeaveBalanceFilterDto } from './dto/employee-leave-balance-filter.dto';
import { GenerateEmployeeLeaveBalancesDto } from './dto/generate-employee-leave-balances.dto';

@ApiTags('Employee Leave Balance')
@Controller('employee-leave-balances')
export class EmployeeLeaveBalanceController {
  constructor(
    private readonly employeeLeaveBalanceService: EmployeeLeaveBalanceService,
    private readonly leaveBalanceGenerationService: LeaveBalanceGenerationService,
  ) {}

  @Post('generate')
  @RequirePermissions('hr.leave.manage')
  generate(@Body() dto: GenerateEmployeeLeaveBalancesDto) {
    return this.leaveBalanceGenerationService.generate(dto);
  }

  @Post()
  @RequirePermissions('hr.leave.manage')
  create(@Body() dto: CreateEmployeeLeaveBalanceDto) {
    return this.employeeLeaveBalanceService.create(dto);
  }

  @Get()
  findAll(@Query() filters: EmployeeLeaveBalanceFilterDto) {
    return this.employeeLeaveBalanceService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.employeeLeaveBalanceService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('hr.leave.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeLeaveBalanceDto,
  ) {
    return this.employeeLeaveBalanceService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('hr.leave.manage')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeactivateEmployeeLeaveBalanceDto,
  ) {
    return this.employeeLeaveBalanceService.remove(id, dto);
  }
}
