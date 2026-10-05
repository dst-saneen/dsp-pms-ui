import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

import { EmployeeDocumentCategoryController } from './employee-document-category.controller';
import { EmployeeDocumentCategoryService } from './employee-document-category.service';
import { EmployeeDocumentCategoryRepository } from './repositories/employee-document-category.repository';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [EmployeeDocumentCategoryController],

  providers: [
    EmployeeDocumentCategoryService,
    EmployeeDocumentCategoryRepository,
  ],
})
export class EmployeeDocumentCategoryModule {}
