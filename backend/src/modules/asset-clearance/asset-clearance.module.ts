import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetClearanceController } from './asset-clearance.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetClearanceController],
})
export class AssetClearanceModule {}
