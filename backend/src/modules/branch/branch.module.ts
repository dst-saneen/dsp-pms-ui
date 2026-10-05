import { Module } from '@nestjs/common';

import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [BranchController],
  providers: [BranchService],
})
export class BranchModule {}
