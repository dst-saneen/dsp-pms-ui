import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  LicenseAllocationService,
  RevokeLicenseCommandDto,
  SearchLicenseAllocationDto,
  createAssetAccessContext,
} from '../asset-domain';

@UseGuards(AssetsEnabledGuard)
@Controller('asset-license-allocations')
export class AssetLicenseAllocationController {
  constructor(private readonly allocations: LicenseAllocationService) {}

  @Get()
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findAll(
    @Query() query: SearchLicenseAllocationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.allocations.findPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.allocations.findDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Patch(':id/revoke')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  revoke(
    @Param('id') id: string,
    @Body() dto: RevokeLicenseCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.allocations.revoke(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
