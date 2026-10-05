import { Controller, Get, Param } from '@nestjs/common';

import { DocumentGeneratorService } from './document-generator.service';

@Controller('documents')
export class DocumentGeneratorController {
  constructor(
    private readonly documentGeneratorService: DocumentGeneratorService,
  ) {}

  @Get('download/:requestId')
  async download(@Param('requestId') requestId: string) {
    return this.documentGeneratorService.getDocumentPath(requestId);
  }
}
