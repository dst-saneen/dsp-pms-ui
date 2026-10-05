import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AssetCommandService,
  AssetsEnabledGuard,
  AssetTaxonomyQueryService,
  createAssetAccessContext,
  SearchAssetTypeDto,
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../asset-domain';

import { CreateAssetTypeDto } from './dto/create-asset-type.dto';
import { UpdateAssetTypeDto } from './dto/update-asset-type.dto';

@UseGuards(AssetsEnabledGuard)
@Controller('asset-types')
export class AssetTypeController {
  constructor(
    private readonly taxonomyQuery: AssetTaxonomyQueryService,
    private readonly commands: AssetCommandService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateAssetTypeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.createType(
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get()
  findAll(
    @Query() query: SearchAssetTypeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.taxonomyQuery.findTypePage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.taxonomyQuery.findTypeDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetTypeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.updateType(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/archive')
  archive(
    @Param('id') id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.archiveType(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/reactivate')
  reactivate(
    @Param('id') id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.reactivateType(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
