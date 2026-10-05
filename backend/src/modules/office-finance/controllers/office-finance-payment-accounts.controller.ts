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

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import {
  CreateFinancePaymentAccountDto,
  SearchFinancePaymentAccountDto,
  UpdateFinancePaymentAccountDto,
} from '../dto/finance-payment-account.dto';
import { VersionedReasonCommandDto } from '../dto/versioned-command.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinancePaymentAccountsService } from '../services/office-finance-payment-accounts.service';

@ApiTags('Office Finance Payment Accounts')
@Controller('office-finance/payment-accounts')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinancePaymentAccountsController {
  constructor(
    private readonly paymentAccounts: OfficeFinancePaymentAccountsService,
  ) {}

  @Get()
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  findAll(
    @Query() query: SearchFinancePaymentAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.findPage(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post()
  @RequirePermissions('finance.settings.manage')
  create(
    @Body() dto: CreateFinancePaymentAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.create(
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id/balance')
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  getBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.getBalance(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.findOne(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Patch(':id')
  @RequirePermissions('finance.settings.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancePaymentAccountDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.update(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/archive')
  @RequirePermissions('finance.settings.manage')
  archive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.paymentAccounts.archive(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }
}
