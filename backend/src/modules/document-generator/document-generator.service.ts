import { GoneException, Injectable } from '@nestjs/common';

/**
 * The retired local-disk HR document generator is deliberately disabled.
 * Private generated documents must be created and linked through File Storage.
 */
@Injectable()
export class DocumentGeneratorService {
  async generateDocument(_requestId: string): Promise<never> {
    throw new GoneException({
      code: 'LEGACY_DOCUMENT_GENERATOR_DISABLED',
      message: 'Use File Storage for generated HR documents.',
    });
  }

  async getDocumentPath(_requestId: string): Promise<never> {
    throw new GoneException({
      code: 'LEGACY_DOCUMENT_GENERATOR_DISABLED',
      message: 'Use the authorized File Storage download endpoint.',
    });
  }
}
