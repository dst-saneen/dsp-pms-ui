import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetCategoryController } from './asset-category.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetCategoryController],
})
export class AssetCategoryModule {}
