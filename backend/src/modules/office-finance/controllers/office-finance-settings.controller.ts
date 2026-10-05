import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';

import { UpdateFinancialProfileDto } from '../dto/financial-profile.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinanceSettingsService } from '../services/office-finance-settings.service';

@ApiTags('Office Finance Settings')
@Controller('office-finance/settings')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinanceSettingsController {
  constructor(private readonly settings: OfficeFinanceSettingsService) {}

  @Get()
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  getSettings(@Req() request: AuthenticatedRequest) {
    return this.settings.getSettings(
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Patch()
  @RequirePermissions('finance.settings.manage')
  updateSettings(
    @Body() dto: UpdateFinancialProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.settings.updateSettings(
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }
}
