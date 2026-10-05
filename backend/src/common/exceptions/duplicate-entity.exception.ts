import { ConflictException } from '@nestjs/common';

export class DuplicateEntityException extends ConflictException {
  constructor(entity: string, value?: string) {
    super(
      value
        ? `${entity} '${value}' already exists.`
        : `${entity} already exists.`,
    );
  }
}
