import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../auth/auth.types';

import { AssetFeatureGateService } from '../asset-feature-gate.service';
import { ASSET_ERROR_CODES } from '../policies/asset-error-codes';

/** Blocks Assets HTTP surfaces unless the selected Company has ASSETS enabled. */
@Injectable()
export class AssetsEnabledGuard implements CanActivate {
  constructor(private readonly featureGate: AssetFeatureGateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.user?.authorization.activeCompanyId;

    if (await this.featureGate.isEnabledForCompany(companyId)) {
      return true;
    }

    throw new ForbiddenException({
      code: ASSET_ERROR_CODES.ASSET_MODULE_NOT_ENABLED,
      message: 'Select a Company with Assets enabled.',
    });
  }
}
