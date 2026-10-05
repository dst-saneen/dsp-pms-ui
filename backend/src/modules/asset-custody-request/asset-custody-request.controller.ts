import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { RequireAnyPermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  ASSET_CUSTODY_MANAGE_PERMISSIONS,
  ASSET_CUSTODY_READ_PERMISSIONS,
  AssetsEnabledGuard,
  AssetCustodyRequestService,
  CompleteCustodyRequestDto,
  RejectCustodyRequestDto,
  SearchAssetCustodyRequestDto,
  StartCustodyRequestReviewDto,
  createAssetAccessContext,
} from '../asset-domain';

@UseGuards(AssetsEnabledGuard)
@Controller('asset-custody-requests')
export class AssetCustodyRequestController {
  constructor(private readonly requests: AssetCustodyRequestService) {}

  @Get()
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findAll(
    @Query() query: SearchAssetCustodyRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.findPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.requests.findDetail(id, createAssetAccessContext(request.user));
  }

  @Post(':id/start-review')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  startReview(
    @Param('id') id: string,
    @Body() dto: StartCustodyRequestReviewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.startReview(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/complete')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteCustodyRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.complete(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/reject')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectCustodyRequestDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.requests.reject(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
