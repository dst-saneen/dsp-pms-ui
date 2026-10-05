import { ConflictException, HttpExceptionOptions } from '@nestjs/common';

/**
 * 409 Conflict with a stable machine-readable code for domain state transitions.
 */
export class DomainConflictException extends ConflictException {
  constructor(
    public readonly code: string,
    message: string,
    options?: HttpExceptionOptions,
  ) {
    super(
      {
        statusCode: 409,
        error: 'Conflict',
        code,
        message,
      },
      options,
    );
  }
}
