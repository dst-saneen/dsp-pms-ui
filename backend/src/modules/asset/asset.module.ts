import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetController],
  providers: [AssetService],
})
export class AssetModule {}
