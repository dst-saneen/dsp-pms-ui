import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import {
  ArchiveEmployeeDeductionDto,
  CreateEmployeeDeductionDto,
  CreateSalaryRevisionDto,
  CreateTaxProfileDto,
  EndSalaryRevisionDto,
  EndTaxProfileDto,
  UpdateEmployeeDeductionDto,
} from '../dto/employee-input.dto';
import { PayrollFeatureGuard } from '../guards/payroll-feature.guard';
import { createPayrollAccessContext } from '../payroll-access.types';
import { PayrollEmployeeInputsService } from '../services/payroll-employee-inputs.service';

@ApiTags('Payroll Employee Inputs')
@Controller('payroll/employees/:employeeId')
@UseGuards(PayrollFeatureGuard)
export class PayrollEmployeeInputsController {
  constructor(private readonly service: PayrollEmployeeInputsService) {}

  @Get('salary-revisions')
  @RequirePermissions('payroll.payroll.read')
  listSalaryRevisions(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listSalaryRevisions(
      employeeId,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('salary-revisions')
  @RequirePermissions('payroll.payroll.manage')
  createSalaryRevision(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateSalaryRevisionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createSalaryRevision(
      employeeId,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('salary-revisions/:id/end')
  @RequirePermissions('payroll.payroll.manage')
  endSalaryRevision(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndSalaryRevisionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.endSalaryRevision(
      employeeId,
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('tax-profiles')
  @RequirePermissions('payroll.payroll.read')
  listTaxProfiles(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listTaxProfiles(
      employeeId,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('tax-profiles')
  @RequirePermissions('payroll.payroll.manage')
  createTaxProfile(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateTaxProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createTaxProfile(
      employeeId,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('tax-profiles/:id/end')
  @RequirePermissions('payroll.payroll.manage')
  endTaxProfile(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EndTaxProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.endTaxProfile(
      employeeId,
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Get('deductions')
  @RequirePermissions('payroll.payroll.read')
  listDeductions(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.listDeductions(
      employeeId,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('deductions')
  @RequirePermissions('payroll.payroll.manage')
  createDeduction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body() dto: CreateEmployeeDeductionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.createDeduction(
      employeeId,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Patch('deductions/:id')
  @RequirePermissions('payroll.payroll.manage')
  updateDeduction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDeductionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateDeduction(
      employeeId,
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post('deductions/:id/archive')
  @RequirePermissions('payroll.payroll.manage')
  archiveDeduction(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchiveEmployeeDeductionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.archiveDeduction(
      employeeId,
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }
}
