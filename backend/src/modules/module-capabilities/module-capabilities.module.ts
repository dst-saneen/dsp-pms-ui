import { Global, Module } from '@nestjs/common';

import { CompanyModuleEntitlementService } from './company-module-entitlement.service';
import { ModuleCapabilitiesService } from './module-capabilities.service';

@Global()
@Module({
  providers: [CompanyModuleEntitlementService, ModuleCapabilitiesService],
  exports: [CompanyModuleEntitlementService, ModuleCapabilitiesService],
})
export class ModuleCapabilitiesModule {}
