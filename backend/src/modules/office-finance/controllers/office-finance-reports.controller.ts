import {
  Controller,
  Get,
  Header,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import { FinanceReportQueryDto } from '../dto/finance-transaction.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinanceReportsService } from '../services/office-finance-reports.service';

@ApiTags('Office Finance Dashboard')
@Controller('office-finance/dashboard')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinanceDashboardController {
  constructor(private readonly reports: OfficeFinanceReportsService) {}

  @Get()
  @RequirePermissions('finance.reports.read')
  getDashboard(@Req() request: AuthenticatedRequest) {
    return this.reports.getDashboard(
      createOfficeFinanceAccessContext(request.user),
    );
  }
}

@ApiTags('Office Finance Reports')
@Controller('office-finance/reports')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinanceReportsController {
  constructor(private readonly reports: OfficeFinanceReportsService) {}

  @Get('income-expense')
  @RequirePermissions('finance.reports.read')
  incomeExpense(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.incomeExpense(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get('by-category')
  @RequirePermissions('finance.reports.read')
  byCategory(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.byCategory(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get('by-department')
  @RequirePermissions('finance.reports.read')
  byDepartment(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.byDepartment(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get('by-project')
  @RequirePermissions('finance.reports.read')
  byProject(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.byProject(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get('account-movements')
  @RequirePermissions('finance.reports.read')
  accountMovements(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.reports.accountMovements(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get('export.csv')
  @RequirePermissions('finance.reports.read')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() query: FinanceReportQueryDto,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const csv = await this.reports.exportCsv(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="office-finance-export.csv"',
    );
    response.send(csv);
  }
}
