import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';

import { DocumentGeneratorService } from './document-generator.service';

import { DocumentGeneratorController } from './document-generator.controller';

@Module({
  imports: [PrismaModule],
  controllers: [DocumentGeneratorController],
  providers: [DocumentGeneratorService],
  exports: [DocumentGeneratorService],
})
export class DocumentGeneratorModule {}
