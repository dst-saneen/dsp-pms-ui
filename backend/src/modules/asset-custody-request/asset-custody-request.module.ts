import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetCustodyRequestController } from './asset-custody-request.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetCustodyRequestController],
})
export class AssetCustodyRequestModule {}
