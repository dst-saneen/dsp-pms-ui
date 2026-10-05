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
  ASSET_CUSTODY_MANAGE_PERMISSIONS,
  ASSET_PERMISSIONS,
  ApproveAssetClearanceWaiverDto,
  AssetClearanceService,
  AssetsEnabledGuard,
  CancelAssetClearanceWaiverDto,
  RejectAssetClearanceWaiverDto,
  RequestAssetClearanceWaiverDto,
  SearchAssetClearanceWaiverDto,
  createAssetAccessContext,
} from '../asset-domain';

const CLEARANCE_READ_PERMISSIONS = [
  ASSET_PERMISSIONS.ASSIGNMENTS_READ,
  ASSET_PERMISSIONS.DEPARTMENT_ASSIGNMENTS_READ,
  'hr.employees.manage',
] as const;

@UseGuards(AssetsEnabledGuard)
@Controller()
export class AssetClearanceController {
  constructor(private readonly clearance: AssetClearanceService) {}

  @Get('employees/:employeeId/asset-clearance-preflight')
  @RequireAnyPermissions(...CLEARANCE_READ_PERMISSIONS)
  preflight(
    @Param('employeeId') employeeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.preflight(
      employeeId,
      createAssetAccessContext(request.user),
    );
  }

  @Get('employee-clearance/:clearanceId/assets')
  @RequireAnyPermissions(...CLEARANCE_READ_PERMISSIONS)
  findClearanceAssets(
    @Param('clearanceId') clearanceId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.findClearanceAssets(
      clearanceId,
      createAssetAccessContext(request.user),
    );
  }

  @Get('asset-clearance-waivers')
  @RequirePermissions(ASSET_PERMISSIONS.CLEARANCE_WAIVE)
  findWaivers(
    @Query() query: SearchAssetClearanceWaiverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.findWaiverPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Get('asset-clearance-waivers/:id')
  @RequirePermissions()
  findWaiver(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.clearance.findWaiverDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Post('asset-clearance-items/:id/waiver-requests')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  requestWaiver(
    @Param('id') id: string,
    @Body() dto: RequestAssetClearanceWaiverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.requestWaiver(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post('asset-clearance-waivers/:id/approve')
  @RequirePermissions(ASSET_PERMISSIONS.CLEARANCE_WAIVE)
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveAssetClearanceWaiverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.approveWaiver(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post('asset-clearance-waivers/:id/reject')
  @RequirePermissions(ASSET_PERMISSIONS.CLEARANCE_WAIVE)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectAssetClearanceWaiverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.rejectWaiver(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post('asset-clearance-waivers/:id/cancel')
  @RequirePermissions()
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelAssetClearanceWaiverDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clearance.cancelWaiver(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
