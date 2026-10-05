import { Module } from '@nestjs/common';

import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [DepartmentController],

  providers: [DepartmentService],
})
export class DepartmentModule {}
