import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';

import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { EmployeeLeaveService } from './employee-leave.service';

import {
  EmployeeLeaveProfileDto,
  EmployeeLeaveSummaryDto,
  EmployeeLeaveBalanceDto,
  EmployeeLeaveHistoryDto,
  EmployeeUpcomingLeaveDto,
} from './dto';

@ApiTags('Employee Leave')
@Controller('employee-leave')
export class EmployeeLeaveController {
  constructor(private readonly employeeLeaveService: EmployeeLeaveService) {}

  @Get(':employeeId')
  @ApiOperation({
    summary: 'Get Employee Leave Profile',
  })
  @ApiResponse({
    status: 200,
    type: EmployeeLeaveProfileDto,
  })
  async getProfile(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,

    @Query('year')
    year?: number,
  ): Promise<EmployeeLeaveProfileDto> {
    return this.employeeLeaveService.getProfile(employeeId, year);
  }

  @Get(':employeeId/summary')
  @ApiResponse({
    type: EmployeeLeaveSummaryDto,
  })
  async getSummary(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,

    @Query('year')
    year?: number,
  ): Promise<EmployeeLeaveSummaryDto> {
    return this.employeeLeaveService.getSummary(employeeId, year);
  }

  @Get(':employeeId/balances')
  @ApiResponse({
    type: [EmployeeLeaveBalanceDto],
  })
  async getBalances(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,

    @Query('year')
    year?: number,
  ): Promise<EmployeeLeaveBalanceDto[]> {
    return this.employeeLeaveService.getBalances(employeeId, year);
  }

  @Get(':employeeId/history')
  @ApiResponse({
    type: [EmployeeLeaveHistoryDto],
  })
  async getHistory(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,
  ): Promise<EmployeeLeaveHistoryDto[]> {
    return this.employeeLeaveService.getHistory(employeeId);
  }

  @Get(':employeeId/upcoming')
  @ApiResponse({
    type: [EmployeeUpcomingLeaveDto],
  })
  async getUpcoming(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,
  ): Promise<EmployeeUpcomingLeaveDto[]> {
    return this.employeeLeaveService.getUpcoming(employeeId);
  }
}
