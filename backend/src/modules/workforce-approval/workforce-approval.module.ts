import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { WorkforceApprovalResolverService } from './workforce-approval-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [WorkforceApprovalResolverService],
  exports: [WorkforceApprovalResolverService],
})
export class WorkforceApprovalModule {}
