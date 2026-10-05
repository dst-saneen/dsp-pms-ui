import { Module } from '@nestjs/common';

import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { AssetDepartmentGrantController } from './asset-department-grant.controller';

@Module({
  imports: [AssetDomainModule],
  controllers: [AssetDepartmentGrantController],
})
export class AssetDepartmentGrantModule {}
