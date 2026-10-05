import { NotFoundException } from '@nestjs/common';

/**
 * 404 Not Found with a stable machine-readable code for out-of-scope or missing records.
 */
export class DomainNotFoundException extends NotFoundException {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super({
      statusCode: 404,
      error: 'Not Found',
      code,
      message,
    });
  }
}
