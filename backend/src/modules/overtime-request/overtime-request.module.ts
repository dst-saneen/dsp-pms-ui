import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CompOffModule } from '../comp-off/comp-off.module';
import { WorkforceApprovalModule } from '../workforce-approval/workforce-approval.module';
import { WorkforcePolicyModule } from '../workforce-policy/workforce-policy.module';

import { OvertimePolicyController } from './overtime-policy.controller';
import { OvertimePolicyService } from './overtime-policy.service';
import { OvertimeRequestController } from './overtime-request.controller';
import { OvertimeRequestService } from './overtime-request.service';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    WorkforcePolicyModule,
    WorkforceApprovalModule,
    CompOffModule,
  ],
  controllers: [OvertimePolicyController, OvertimeRequestController],
  providers: [OvertimePolicyService, OvertimeRequestService],
  exports: [OvertimeRequestService, OvertimePolicyService],
})
export class OvertimeRequestModule {}
