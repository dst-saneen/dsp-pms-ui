import { Injectable } from '@nestjs/common';

import { AssetQueryService } from '../asset-domain/asset-query.service';
import { createAssetAccessContext } from '../asset-domain/asset-access.types';
import type {
  SearchEligibleEmployeesDto,
  SearchEligibleForAssignmentDto,
} from '../asset-domain';
import type { AuthenticatedUser } from '../auth/auth.types';

import { SearchAssetDto } from './dto/search-asset.dto';
import { SearchAssetHistoryQueryDto } from './dto/search-asset-history.dto';

@Injectable()
export class AssetService {
  constructor(private readonly assetQuery: AssetQueryService) {}

  findAll(query: SearchAssetDto, user: AuthenticatedUser) {
    return this.assetQuery.findInventoryPage(
      query,
      createAssetAccessContext(user),
    );
  }

  findOne(id: string, user: AuthenticatedUser) {
    return this.assetQuery.findInventoryDetail(
      id,
      createAssetAccessContext(user),
    );
  }

  findHistory(
    id: string,
    query: SearchAssetHistoryQueryDto,
    user: AuthenticatedUser,
  ) {
    return this.assetQuery.findInventoryHistory(
      id,
      query,
      createAssetAccessContext(user),
    );
  }

  summarizeInventory(user: AuthenticatedUser) {
    return this.assetQuery.summarizeInventory(createAssetAccessContext(user));
  }

  findEligibleEmployees(
    query: SearchEligibleEmployeesDto,
    user: AuthenticatedUser,
  ) {
    return this.assetQuery.findEligibleEmployees(
      query,
      createAssetAccessContext(user),
    );
  }

  findEligibleForAssignment(
    query: SearchEligibleForAssignmentDto,
    user: AuthenticatedUser,
  ) {
    return this.assetQuery.findEligibleForAssignment(
      query,
      createAssetAccessContext(user),
    );
  }
}
