import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
} from '@nestjs/common';

import { PayrollDashboardService } from './payroll-dashboard.service';

@Controller('payroll-dashboard')
export class PayrollDashboardController {
  constructor(
    private readonly payrollDashboardService: PayrollDashboardService,
  ) {}

  @Get('company/:companyId')
  getCompanySummary(
    @Param('companyId', ParseUUIDPipe)
    companyId: string,
  ) {
    return this.payrollDashboardService.getCompanySummary(companyId);
  }

  @Get('monthly/:year/:month')
  getMonthlySummary(
    @Param('year', ParseIntPipe)
    year: number,

    @Param('month', ParseIntPipe)
    month: number,
  ) {
    return this.payrollDashboardService.getMonthlySummary(year, month);
  }

  @Get('employee/:employeeId')
  getEmployeeHistory(
    @Param('employeeId', ParseUUIDPipe)
    employeeId: string,
  ) {
    return this.payrollDashboardService.getEmployeeHistory(employeeId);
  }
}
