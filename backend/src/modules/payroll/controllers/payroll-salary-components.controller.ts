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
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import {
  ArchiveSalaryComponentDto,
  CreateSalaryComponentDto,
  SearchSalaryComponentDto,
  UpdateSalaryComponentDto,
} from '../dto/salary-component.dto';
import { PayrollFeatureGuard } from '../guards/payroll-feature.guard';
import { createPayrollAccessContext } from '../payroll-access.types';
import { PayrollSalaryComponentsService } from '../services/payroll-salary-components.service';

@ApiTags('Payroll Salary Components')
@Controller('payroll/salary-components')
@UseGuards(PayrollFeatureGuard)
export class PayrollSalaryComponentsController {
  constructor(private readonly service: PayrollSalaryComponentsService) {}

  @Get()
  @RequirePermissions('payroll.payroll.read')
  findAll(
    @Query() query: SearchSalaryComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findPage(
      query,
      createPayrollAccessContext(request.user),
    );
  }

  @Post()
  @RequirePermissions('payroll.payroll.manage')
  create(
    @Body() dto: CreateSalaryComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.create(dto, createPayrollAccessContext(request.user));
  }

  @Get(':id')
  @RequirePermissions('payroll.payroll.read')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.findOne(id, createPayrollAccessContext(request.user));
  }

  @Patch(':id')
  @RequirePermissions('payroll.payroll.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSalaryComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.update(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }

  @Post(':id/archive')
  @RequirePermissions('payroll.payroll.manage')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ArchiveSalaryComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.archive(
      id,
      dto,
      createPayrollAccessContext(request.user),
    );
  }
}
