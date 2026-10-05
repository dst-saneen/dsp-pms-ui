import { BadRequestException } from '@nestjs/common';

export class InvalidOperationException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
