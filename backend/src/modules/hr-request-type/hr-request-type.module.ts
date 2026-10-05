import { Module } from '@nestjs/common';
import { HrRequestTypeService } from './hr-request-type.service';
import { HrRequestTypeController } from './hr-request-type.controller';
import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [HrRequestTypeController],
  providers: [HrRequestTypeService],
})
export class HrRequestTypeModule {}
