import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
  AssetCustodyService,
  AssetsEnabledGuard,
  AssignEmployeeAssetCommandDto,
  CloseEmployeeAssetCommandDto,
  SearchEmployeeAssetDto,
  createAssetAccessContext,
} from '../asset-domain';

@UseGuards(AssetsEnabledGuard)
@Controller('employee-assets')
export class EmployeeAssetController {
  constructor(private readonly custody: AssetCustodyService) {}

  @Post()
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  create(
    @Body() dto: AssignEmployeeAssetCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.custody.assign(dto, createAssetAccessContext(request.user));
  }

  @Get()
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findAll(
    @Query() query: SearchEmployeeAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.custody.findPage(query, createAssetAccessContext(request.user));
  }

  @Get('employee/:employeeId')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findByEmployee(
    @Param('employeeId') employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.custody.findByEmployee(
      employeeId,
      createAssetAccessContext(request.user),
    );
  }

  @Get('asset/:assetId')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findByAsset(
    @Param('assetId') assetId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.custody.findByAsset(
      assetId,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.custody.findDetail(id, createAssetAccessContext(request.user));
  }

  @Patch(':id/return')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  returnAsset(
    @Param('id') id: string,
    @Body() dto: CloseEmployeeAssetCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.custody.close(id, dto, createAssetAccessContext(request.user));
  }
}
