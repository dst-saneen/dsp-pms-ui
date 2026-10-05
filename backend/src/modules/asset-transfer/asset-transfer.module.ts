import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetTransferController } from './asset-transfer.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetTransferController],
})
export class AssetTransferModule {}
