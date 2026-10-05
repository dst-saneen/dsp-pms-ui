import { Module } from '@nestjs/common';

import { EmployeeAssignmentController } from './employee-assignment.controller';

import { EmployeeAssignmentService } from './employee-assignment.service';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [EmployeeAssignmentController],

  providers: [EmployeeAssignmentService],
})
export class EmployeeAssignmentModule {}
