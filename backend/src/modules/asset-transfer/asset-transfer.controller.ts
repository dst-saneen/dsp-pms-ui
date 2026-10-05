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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  ASSET_PERMISSIONS,
  AcceptAssetTransferCommandDto,
  AssetTransferService,
  AssetsEnabledGuard,
  CancelAssetTransferCommandDto,
  ForceAssetTransferCommandDto,
  RejectAssetTransferCommandDto,
  SearchAssetTransferDto,
  createAssetAccessContext,
} from '../asset-domain';

@UseGuards(AssetsEnabledGuard)
@Controller('asset-transfers')
export class AssetTransferController {
  constructor(private readonly transfers: AssetTransferService) {}

  @Get()
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_READ,
    ASSET_PERMISSIONS.DEPARTMENT_READ,
  )
  findAll(
    @Query() query: SearchAssetTransferDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.findPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_READ,
    ASSET_PERMISSIONS.DEPARTMENT_READ,
  )
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.transfers.findDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/accept')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  accept(
    @Param('id') id: string,
    @Body() dto: AcceptAssetTransferCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.accept(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/reject')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAssetTransferCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.reject(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/cancel')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAssetTransferCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.cancel(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/force')
  @RequirePermissions(ASSET_PERMISSIONS.TRANSFERS_FORCE)
  force(
    @Param('id') id: string,
    @Body() dto: ForceAssetTransferCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.force(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
