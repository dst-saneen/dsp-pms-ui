import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetTypeController } from './asset-type.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetTypeController],
})
export class AssetTypeModule {}
