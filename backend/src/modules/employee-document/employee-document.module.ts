import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { FileStorageModule } from '../file-storage/file-storage.module';

import { EmployeeDocumentController } from './employee-document.controller';
import { EmployeeDocumentService } from './employee-document.service';
import { EmployeeDocumentRepository } from './employee-document.repository';
import { EmployeeDocumentMapper } from './employee-document.mapper';

@Module({
  imports: [PrismaModule, AuditModule, forwardRef(() => FileStorageModule)],

  controllers: [EmployeeDocumentController],

  providers: [
    EmployeeDocumentService,
    EmployeeDocumentRepository,
    EmployeeDocumentMapper,
  ],

  exports: [EmployeeDocumentService],
})
export class EmployeeDocumentModule {}
