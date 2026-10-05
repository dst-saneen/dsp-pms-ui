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
  CreateFinanceCategoryDto,
  SearchFinanceCategoryDto,
  UpdateFinanceCategoryDto,
} from '../dto/finance-category.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { OfficeFinanceCategoriesService } from '../services/office-finance-categories.service';

@ApiTags('Office Finance Categories')
@Controller('office-finance/categories')
@UseGuards(OfficeFinanceFeatureGuard)
export class OfficeFinanceCategoriesController {
  constructor(private readonly categories: OfficeFinanceCategoriesService) {}

  @Get()
  @RequireAnyPermissions('finance.transactions.read', 'finance.settings.manage')
  findAll(
    @Query() query: SearchFinanceCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.categories.findPage(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post()
  @RequirePermissions('finance.settings.manage')
  create(
    @Body() dto: CreateFinanceCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.categories.create(
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
    return this.categories.findOne(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Patch(':id')
  @RequirePermissions('finance.settings.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinanceCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.categories.update(
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
    return this.categories.archive(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post(':id/reactivate')
  @RequirePermissions('finance.settings.manage')
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.categories.reactivate(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }
}
