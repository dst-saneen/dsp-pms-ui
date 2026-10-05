import { Module } from '@nestjs/common';
import { HrRequestService } from './hr-request.service';
import { HrRequestController } from './hr-request.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { OutboxModule } from '../outbox/outbox.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';
import { HrOperationsCommandReceiptService } from '../hr-operations/hr-operations-command-receipt.service';
import { FileStorageModule } from '../file-storage/file-storage.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    OutboxModule,
    WorkforceApprovalModule,
    FileStorageModule,
  ],
  controllers: [HrRequestController],
  providers: [HrRequestService, HrOperationsCommandReceiptService],
})
export class HrRequestModule {}
