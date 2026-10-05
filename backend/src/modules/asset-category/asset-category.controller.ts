import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  AssetCommandService,
  AssetsEnabledGuard,
  AssetTaxonomyQueryService,
  createAssetAccessContext,
  SearchAssetCategoryDto,
  VersionedCommandDto,
  VersionedReasonCommandDto,
} from '../asset-domain';

import { CreateAssetCategoryDto } from './dto/create-asset-category.dto';
import { UpdateAssetCategoryDto } from './dto/update-asset-category.dto';

@ApiTags('Asset Categories')
@UseGuards(AssetsEnabledGuard)
@Controller('asset-categories')
export class AssetCategoryController {
  constructor(
    private readonly taxonomyQuery: AssetTaxonomyQueryService,
    private readonly commands: AssetCommandService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create Asset Category' })
  create(
    @Body() dto: CreateAssetCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.createCategory(
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated asset categories' })
  findAll(
    @Query() query: SearchAssetCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.taxonomyQuery.findCategoryPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset category by id' })
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.taxonomyQuery.findCategoryDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Asset Category' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.updateCategory(
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
    return this.commands.archiveCategory(
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
    return this.commands.reactivateCategory(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
