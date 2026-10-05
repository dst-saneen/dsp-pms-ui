import { Module } from '@nestjs/common';

import { DocumentTemplateService } from './document-template.service';

import { DocumentTemplateController } from './document-template.controller';

import { PrismaModule } from '../../prisma/prisma.module';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],

  controllers: [DocumentTemplateController],

  providers: [DocumentTemplateService],
})
export class DocumentTemplateModule {}
