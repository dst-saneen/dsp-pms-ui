import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import { createPayrollAccessContext } from '../payroll-access.types';
import { PayrollPayslipsService } from '../services/payroll-payslips.service';
import { PayrollFeatureGuard } from '../guards/payroll-feature.guard';

@ApiTags('Payroll Self Service')
@Controller('me/payslips')
@UseGuards(PayrollFeatureGuard)
export class PayrollPayslipsController {
  constructor(private readonly payslips: PayrollPayslipsService) {}

  @Get()
  @RequirePermissions('payroll.self.read')
  list(@Req() request: AuthenticatedRequest) {
    return this.payslips.listMine(createPayrollAccessContext(request.user));
  }

  @Get(':id')
  @RequirePermissions('payroll.self.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payslips.findMine(id, createPayrollAccessContext(request.user));
  }

  @Post(':id/download-grant')
  @RequirePermissions('payroll.self.read')
  downloadGrant(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payslips.createDownloadGrant(
      id,
      createPayrollAccessContext(request.user),
      request.headers['x-request-id'] as string | undefined,
    );
  }
}
