import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';
import { VersionedReasonCommandDto } from '../dto/versioned-command.dto';
import { ListPayslipOperationsDto } from '../dto/payslip-operations.dto';
import { PayrollFeatureGuard } from '../guards/payroll-feature.guard';
import { createPayrollAccessContext } from '../payroll-access.types';
import { PAYROLL_PERMISSIONS } from '../policies/payroll-permissions';
import { PayrollPayslipsService } from '../services/payroll-payslips.service';

@ApiTags('Payroll Payslip Operations')
@Controller('payroll/payslips')
@UseGuards(PayrollFeatureGuard)
export class PayrollPayslipOperationsController {
  constructor(private readonly payslips: PayrollPayslipsService) {}

  @Get('operations')
  @RequirePermissions(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)
  list(
    @Query() query: ListPayslipOperationsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payslips.listOperations(
      createPayrollAccessContext(request.user),
      query,
    );
  }

  @Post(':id/retry')
  @RequirePermissions(PAYROLL_PERMISSIONS.PAYROLL_MANAGE)
  retry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payslips.retry(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }
}
