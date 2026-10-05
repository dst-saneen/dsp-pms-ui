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
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  ASSET_CUSTODY_MANAGE_PERMISSIONS,
  ASSET_CUSTODY_READ_PERMISSIONS,
  ASSET_PERMISSIONS,
  AllocateLicenseCommandDto,
  AssetsEnabledGuard,
  AssetCommandService,
  AssetTransferService,
  CardExactLookupDto,
  CompleteAssetRepairCommandDto,
  CorrectAssetIdentifierCommandDto,
  createAssetAccessContext,
  LicenseAllocationService,
  RequestAssetTransferCommandDto,
  ResizeLicensePoolCommandDto,
  SearchLicenseAllocationDto,
  SearchEligibleEmployeesDto,
  SearchEligibleForAssignmentDto,
  VersionedCommandDto,
  VersionedEffectiveDateCommandDto,
  VersionedReasonCommandDto,
} from '../asset-domain';

import { AssetService } from './asset.service';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { SearchAssetDto } from './dto/search-asset.dto';
import { SearchAssetHistoryQueryDto } from './dto/search-asset-history.dto';

@UseGuards(AssetsEnabledGuard)
@Controller('asset')
export class AssetController {
  constructor(
    private readonly assetService: AssetService,
    private readonly commands: AssetCommandService,
    private readonly licenseAllocations: LicenseAllocationService,
    private readonly transfers: AssetTransferService,
  ) {}

  @Post()
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  create(
    @Body() createAssetDto: CreateAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.createAsset(
      createAssetDto,
      createAssetAccessContext(request.user),
    );
  }

  @Get('summary')
  summarize(@Req() request: AuthenticatedRequest) {
    return this.assetService.summarizeInventory(request.user);
  }

  @Post('cards/exact-lookup')
  @RequirePermissions(ASSET_PERMISSIONS.CARDS_SENSITIVE_LOOKUP)
  lookupCard(
    @Body() dto: CardExactLookupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.lookupCardExact(
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get()
  findAll(
    @Query() query: SearchAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetService.findAll(query, request.user);
  }

  @Get('eligible-employees')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  findEligibleEmployees(
    @Query() query: SearchEligibleEmployeesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetService.findEligibleEmployees(query, request.user);
  }

  @Get('eligible-for-assignment')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  findEligibleForAssignment(
    @Query() query: SearchEligibleForAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetService.findEligibleForAssignment(query, request.user);
  }

  @Post(':id/archive')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  archive(
    @Param('id') id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.archiveAsset(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/reactivate')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  reactivate(
    @Param('id') id: string,
    @Body() dto: VersionedCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.reactivateAsset(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/send-to-repair')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  sendToRepair(
    @Param('id') id: string,
    @Body() dto: VersionedEffectiveDateCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.sendToRepair(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/complete-repair')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  completeRepair(
    @Param('id') id: string,
    @Body() dto: CompleteAssetRepairCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.completeRepair(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/mark-lost')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  markLost(
    @Param('id') id: string,
    @Body() dto: VersionedEffectiveDateCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.markLost(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/dispose')
  @RequirePermissions(ASSET_PERMISSIONS.ASSETS_MANAGE)
  dispose(
    @Param('id') id: string,
    @Body() dto: VersionedEffectiveDateCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.dispose(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/suspend')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  suspend(
    @Param('id') id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.suspend(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/resume')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  resume(
    @Param('id') id: string,
    @Body() dto: VersionedReasonCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.resume(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/retire')
  @RequirePermissions(ASSET_PERMISSIONS.ASSETS_MANAGE)
  retire(
    @Param('id') id: string,
    @Body() dto: VersionedEffectiveDateCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.retire(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/license-capacity')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  resizeLicenseCapacity(
    @Param('id') id: string,
    @Body() dto: ResizeLicensePoolCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.resizeLicenseCapacity(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/correct-identifier')
  @RequirePermissions(ASSET_PERMISSIONS.ASSETS_MANAGE)
  correctIdentifier(
    @Param('id') id: string,
    @Body() dto: CorrectAssetIdentifierCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.correctIdentifier(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/transfers')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  requestTransfer(
    @Param('id') id: string,
    @Body() dto: RequestAssetTransferCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfers.request(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id/license-allocations')
  @RequireAnyPermissions(...ASSET_CUSTODY_READ_PERMISSIONS)
  findLicenseAllocations(
    @Param('id') id: string,
    @Query() query: SearchLicenseAllocationDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.licenseAllocations.findPage(
      { ...query, assetId: id },
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/license-allocations')
  @RequireAnyPermissions(...ASSET_CUSTODY_MANAGE_PERMISSIONS)
  allocateLicense(
    @Param('id') id: string,
    @Body() dto: AllocateLicenseCommandDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.licenseAllocations.allocate(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get(':id/history')
  findHistory(
    @Param('id') id: string,
    @Query() query: SearchAssetHistoryQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.assetService.findHistory(id, query, request.user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.assetService.findOne(id, request.user);
  }

  @Patch(':id')
  @RequireAnyPermissions(
    ASSET_PERMISSIONS.ASSETS_MANAGE,
    ASSET_PERMISSIONS.DEPARTMENT_MANAGE,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.commands.updateAssetMetadata(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
