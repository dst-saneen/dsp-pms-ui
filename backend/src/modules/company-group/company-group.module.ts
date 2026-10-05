import { Module } from '@nestjs/common';

import { CompanyGroupController } from './company-group.controller';
import { CompanyGroupService } from './company-group.service';

import { AuditModule } from '../audit/audit.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [AuditModule, PrismaModule],

  controllers: [CompanyGroupController],

  providers: [CompanyGroupService],
})
export class CompanyGroupModule {}
