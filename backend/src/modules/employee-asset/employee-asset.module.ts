import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';

import { EmployeeAssetController } from './employee-asset.controller';
import { EmployeeAssetService } from './employee-asset.service';

@Module({
  imports: [PrismaModule, AuditModule, AssetDomainModule],
  controllers: [EmployeeAssetController],
  providers: [EmployeeAssetService],
  exports: [EmployeeAssetService],
})
export class EmployeeAssetModule {}
