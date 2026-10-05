import { Module } from '@nestjs/common';
import { EmployeeClearanceService } from './employee-clearance.service';
import { EmployeeClearanceController } from './employee-clearance.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AssetDomainModule } from '../asset-domain/asset-domain.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';

@Module({
  imports: [PrismaModule, AssetDomainModule, AuditModule, OutboxModule],
  controllers: [EmployeeClearanceController],
  providers: [EmployeeClearanceService, HrOperationsCommandReceiptService],
  exports: [EmployeeClearanceService],
})
export class EmployeeClearanceModule {}
