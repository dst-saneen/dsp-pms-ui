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
  CreateBusinessPartyDto,
  SearchBusinessPartyDto,
  UpdateBusinessPartyDto,
} from '../dto/business-party.dto';
import {
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../dto/versioned-command.dto';
import { OfficeFinanceFeatureGuard } from '../guards/office-finance-feature.guard';
import { createOfficeFinanceAccessContext } from '../office-finance-access.types';
import { BusinessPartyService } from '../services/business-party.service';

@ApiTags('Business Parties')
@Controller('business-parties')
@UseGuards(OfficeFinanceFeatureGuard)
export class BusinessPartyController {
  constructor(private readonly businessParties: BusinessPartyService) {}

  @Get()
  @RequireAnyPermissions(
    'finance.transactions.read',
    'finance.settings.manage',
    'projects.projects.manage',
  )
  findAll(
    @Query() query: SearchBusinessPartyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessParties.findPage(
      query,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Post()
  @RequireAnyPermissions('finance.settings.manage', 'projects.projects.manage')
  create(
    @Body() dto: CreateBusinessPartyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessParties.create(
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(
    'finance.transactions.read',
    'finance.settings.manage',
    'projects.projects.manage',
  )
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessParties.findOne(
      id,
      createOfficeFinanceAccessContext(request.user),
    );
  }

  @Patch(':id')
  @RequirePermissions('finance.settings.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBusinessPartyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.businessParties.update(
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
    return this.businessParties.archive(
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
    return this.businessParties.reactivate(
      id,
      dto,
      createOfficeFinanceAccessContext(request.user),
    );
  }
}
