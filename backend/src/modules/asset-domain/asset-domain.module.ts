import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';

import { AssetAccessService } from './asset-access.service';
import { AssetAuditMapper } from './asset-audit.mapper';
import { AssetCapabilityService } from './asset-capability.service';
import { AssetClearanceService } from './asset-clearance.service';
import { AssetCommandService } from './asset-command.service';
import { AssetCustodyPreflightService } from './asset-custody-preflight.service';
import { AssetCustodyRequestService } from './asset-custody-request.service';
import { AssetCustodyService } from './asset-custody.service';
import { AssetDepartmentGrantCommandService } from './asset-department-grant-command.service';
import { AssetDepartmentGrantQueryService } from './asset-department-grant-query.service';
import { AssetFeatureGateService } from './asset-feature-gate.service';
import { AssetsEnabledGuard } from './guards/assets-enabled.guard';
import { AssetIdempotencyService } from './asset-idempotency.service';
import { AssetNotificationService } from './asset-notification.service';
import { AssetQueryService } from './asset-query.service';
import { AssetResponseMapper } from './asset-response.mapper';
import { AssetSelfServiceQueryService } from './asset-self-service-query.service';
import { AssetSensitiveIdentifierService } from './asset-sensitive-identifier.service';
import { AssetTaxonomyQueryService } from './asset-taxonomy-query.service';
import { AssetTransferService } from './asset-transfer.service';
import { LicenseAllocationService } from './license-allocation.service';

const providers = [
  AssetFeatureGateService,
  AssetsEnabledGuard,
  AssetAccessService,
  AssetQueryService,
  AssetTaxonomyQueryService,
  AssetSelfServiceQueryService,
  AssetDepartmentGrantQueryService,
  AssetDepartmentGrantCommandService,
  AssetCommandService,
  AssetIdempotencyService,
  AssetCustodyService,
  AssetCustodyPreflightService,
  LicenseAllocationService,
  AssetTransferService,
  AssetCustodyRequestService,
  AssetClearanceService,
  AssetCapabilityService,
  AssetResponseMapper,
  AssetAuditMapper,
  AssetNotificationService,
  AssetSensitiveIdentifierService,
];

@Module({
  imports: [PrismaModule, AuditModule, forwardRef(() => OutboxModule)],
  providers,
  exports: [
    AssetFeatureGateService,
    AssetsEnabledGuard,
    AssetAccessService,
    AssetQueryService,
    AssetTaxonomyQueryService,
    AssetSelfServiceQueryService,
    AssetDepartmentGrantQueryService,
    AssetDepartmentGrantCommandService,
    AssetCommandService,
    AssetIdempotencyService,
    AssetCustodyService,
    AssetCustodyPreflightService,
    LicenseAllocationService,
    AssetTransferService,
    AssetCustodyRequestService,
    AssetClearanceService,
    AssetCapabilityService,
    AssetResponseMapper,
    AssetAuditMapper,
    AssetNotificationService,
    AssetSensitiveIdentifierService,
  ],
})
export class AssetDomainModule {}
