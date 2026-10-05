import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import { CreateFinancePeriodDto } from '../dto/finance-period.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinancePeriodsService } from '../services/office-finance-periods.service';

@ApiTags('Office Finance Periods')
@Controller('office-finance/periods')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinancePeriodsController {
  constructor(private readonly periods: OfficeFinancePeriodsService) {}

  @Get()
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  findAll(@Req() request: AuthenticatedRequest) {
    return this.periods.findAll(createOfficeFinanceAccessContext(request.user));
  }

  @Post()
  @RequirePermissions('finance.settings.manage')
  create(
    @Body() dto: CreateFinancePeriodDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periods.create(
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periods.findOne(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/lock')
  @RequirePermissions('finance.transactions.approve')
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periods.lock(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/reopen')
  @RequirePermissions('finance.transactions.approve')
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.periods.reopen(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }
}
