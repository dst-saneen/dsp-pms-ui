import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import type { AuthenticatedRequest } from '../../auth';

import { DeliveryFeatureGateService } from '../delivery-feature-gate.service';

@Injectable()
export class DeliveryEnabledGuard implements CanActivate {
  constructor(private readonly featureGate: DeliveryFeatureGateService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const companyId = request.user?.authorization.activeCompanyId;

    if (await this.featureGate.isEnabledForCompany(companyId)) {
      return true;
    }

    throw new ForbiddenException({
      code: 'DELIVERY_MODULE_NOT_ENABLED',
      message: 'Select a Company with Delivery enabled.',
    });
  }
}
