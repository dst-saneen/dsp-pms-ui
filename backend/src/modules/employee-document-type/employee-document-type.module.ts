import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

import { EmployeeDocumentTypeController } from './employee-document-type.controller';
import { EmployeeDocumentTypeService } from './employee-document-type.service';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [EmployeeDocumentTypeController],

  providers: [EmployeeDocumentTypeService],
})
export class EmployeeDocumentTypeModule {}
