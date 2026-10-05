import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { BusinessCalendarModule } from '../business-calendar/business-calendar.module';

import { LeavePolicyController } from './leave-policy.controller';
import { LeavePolicyMatrixService } from './leave-policy-matrix.service';
import { LeavePolicyResolverService } from './leave-policy-resolver.service';
import { LeavePolicyService } from './leave-policy.service';

@Module({
  imports: [PrismaModule, AuditModule, BusinessCalendarModule],
  controllers: [LeavePolicyController],
  providers: [
    LeavePolicyService,
    LeavePolicyMatrixService,
    LeavePolicyResolverService,
  ],
  exports: [
    LeavePolicyService,
    LeavePolicyMatrixService,
    LeavePolicyResolverService,
  ],
})
export class LeavePolicyModule {}
