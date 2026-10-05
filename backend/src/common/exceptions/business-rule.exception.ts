import { BadRequestException } from '@nestjs/common';

export class BusinessRuleException extends BadRequestException {
  constructor(message: string) {
    super(message);
  }
}
