import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { AttendancePolicyResolverService } from './attendance-policy-resolver.service';
import { OvertimePolicyResolverService } from './overtime-policy-resolver.service';

@Module({
  imports: [PrismaModule],
  providers: [AttendancePolicyResolverService, OvertimePolicyResolverService],
  exports: [AttendancePolicyResolverService, OvertimePolicyResolverService],
})
export class WorkforcePolicyModule {}
