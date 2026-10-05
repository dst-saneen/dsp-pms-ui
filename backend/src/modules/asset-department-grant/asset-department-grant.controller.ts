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
import { ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import {
  ASSET_PERMISSIONS,
  AssetsEnabledGuard,
  AssetDepartmentGrantCommandService,
  AssetDepartmentGrantQueryService,
  CreateDepartmentAssetGrantDto,
  SearchDepartmentAssetGrantDto,
  VersionedDepartmentAssetGrantDto,
  createAssetAccessContext,
} from '../asset-domain';

@ApiTags('Asset Department Grants')
@UseGuards(AssetsEnabledGuard)
@Controller('asset-department-grants')
export class AssetDepartmentGrantController {
  constructor(
    private readonly grantQuery: AssetDepartmentGrantQueryService,
    private readonly grantCommands: AssetDepartmentGrantCommandService,
  ) {}

  @Get()
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  findAll(
    @Query() query: SearchDepartmentAssetGrantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantQuery.findGrantPage(
      query,
      createAssetAccessContext(request.user),
    );
  }

  @Post()
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  create(
    @Body() dto: CreateDepartmentAssetGrantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantCommands.create(
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Get('eligible-users')
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  findEligibleUsers(
    @Query('departmentId') departmentId: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantQuery.findEligibleGrantUsers(
      createAssetAccessContext(request.user),
      departmentId,
    );
  }

  @Get(':id')
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.grantQuery.findGrantDetail(
      id,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/reactivate')
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  reactivate(
    @Param('id') id: string,
    @Body() dto: VersionedDepartmentAssetGrantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantCommands.reactivate(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/regrant')
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  regrant(
    @Param('id') id: string,
    @Body() dto: VersionedDepartmentAssetGrantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantCommands.regrant(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }

  @Post(':id/revoke')
  @RequirePermissions(ASSET_PERMISSIONS.DEPARTMENT_ACCESS_MANAGE)
  revoke(
    @Param('id') id: string,
    @Body() dto: VersionedDepartmentAssetGrantDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grantCommands.revoke(
      id,
      dto,
      createAssetAccessContext(request.user),
    );
  }
}
