import { Module, forwardRef } from '@nestjs/common';

import { EmployeeController } from './employee.controller';
import { EmployeeService } from './employee.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';

@Module({
  imports: [PrismaModule, AuditModule, forwardRef(() => AssetDomainModule)],

  controllers: [EmployeeController],

  providers: [EmployeeService],

  exports: [EmployeeService],
})
export class EmployeeModule {}
