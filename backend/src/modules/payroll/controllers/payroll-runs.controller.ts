import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { SkipResponseEnvelope } from '../../../common/decorators/skip-response-envelope.decorator';
import type { AuthenticatedRequest } from '../../auth';

import {
  ApprovePayrollRunDto,
  CalculatePayrollRunDto,
  CancelPayrollRunDto,
  CreatePayrollAdjustmentDto,
  CreatePayrollRunDto,
  MarkPayrollPaidDto,
  PreflightQueryDto,
  RemovePayrollAdjustmentDto,
  ReturnPayrollToDraftDto,
  SearchPayrollRunDto,
  UpdatePayrollAdjustmentDto,
} from '../dto/payroll-run.dto';
import { PayrollFeatureGuard } from '../guards/payroll-feature.guard';
import { createPayrollAccessContext } from '../payroll-access.types';
import { PayrollDashboardService } from '../services/payroll-dashboard.service';
import { PayrollRunsService } from '../services/payroll-runs.service';

@ApiTags('Payroll Runs')
@Controller('payroll')
@UseGuards(PayrollFeatureGuard)
export class PayrollRunsController {
  constructor(
    private readonly runs: PayrollRunsService,
    private readonly dashboardService: PayrollDashboardService,
  ) {}

  @Get('preflight')
  @RequirePermissions('payroll.payroll.read')
  preflight(
    @Query() query: PreflightQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.getPreflight(
      query.year,
      query.month,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('runs')
  @RequirePermissions('payroll.payroll.read')
  findRuns(
    @Query() query: SearchPayrollRunDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.findPage(query, createPayrollAccessContext(request.user));
  }

  @Post('runs')
  @RequirePermissions('payroll.payroll.manage')
  createRun(
    @Body() dto: CreatePayrollRunDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.create(dto, createPayrollAccessContext(request.user));
  }

  @Get('runs/:id')
  @RequirePermissions('payroll.payroll.read')
  findRun(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.findOne(id, createPayrollAccessContext(request.user));
  }

  @Get('runs/:id/employees')
  @RequirePermissions('payroll.payroll.read')
  findRunEmployees(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.findEmployees(
      id,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('runs/:id/employees/:employeeId')
  @RequirePermissions('payroll.payroll.read')
  findRunEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.findEmployee(
      id,
      employeeId,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('runs/:id/history')
  @RequirePermissions('payroll.payroll.read')
  findRunHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.findHistory(id, createPayrollAccessContext(request.user));
  }

  @Post('runs/:id/adjustments')
  @RequirePermissions('payroll.payroll.manage')
  createAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePayrollAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.createAdjustment(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Patch('runs/:id/adjustments/:adjustmentId')
  @RequirePermissions('payroll.payroll.manage')
  updateAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @Body() dto: UpdatePayrollAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.updateAdjustment(
      id,
      adjustmentId,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('runs/:id/adjustments/:adjustmentId/remove')
  @RequirePermissions('payroll.payroll.manage')
  removeAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('adjustmentId', ParseUUIDPipe) adjustmentId: string,
    @Body() dto: RemovePayrollAdjustmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.removeAdjustment(
      id,
      adjustmentId,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('runs/:id/calculate')
  @RequirePermissions('payroll.payroll.manage')
  calculate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CalculatePayrollRunDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.calculate(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('runs/:id/return-to-draft')
  @RequirePermissions('payroll.payroll.manage')
  returnToDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReturnPayrollToDraftDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.returnToDraft(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('runs/:id/approve')
  @RequirePermissions('payroll.payroll.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApprovePayrollRunDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.approve(id, dto, createPayrollAccessContext(request.user));
  }

  @Post('runs/:id/mark-paid')
  @RequirePermissions('payroll.payroll.approve')
  markPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkPayrollPaidDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.markPaid(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('runs/:id/cancel')
  @RequirePermissions('payroll.payroll.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelPayrollRunDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.cancel(id, dto, createPayrollAccessContext(request.user));
  }

  @Get('runs/:id/register.csv')
  @RequirePermissions('payroll.payroll.read')
  @SkipResponseEnvelope()
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="payroll-register.csv"')
  async registerCsv(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.runs.buildRegisterCsv(
      id,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('dashboard')
  @RequirePermissions('payroll.payroll.read')
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.dashboardService.getDashboard(
      createPayrollAccessContext(request.user),
    );
  }
}
