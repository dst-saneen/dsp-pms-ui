import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetLicenseAllocationController } from './asset-license-allocation.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetLicenseAllocationController],
})
export class AssetLicenseAllocationModule {}
