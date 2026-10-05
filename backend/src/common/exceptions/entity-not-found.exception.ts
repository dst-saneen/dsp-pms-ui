import { NotFoundException } from '@nestjs/common';

export class EntityNotFoundException extends NotFoundException {
  constructor(entity: string, identifier?: string | number) {
    super(
      identifier !== undefined
        ? `${entity} with identifier '${identifier}' was not found.`
        : `${entity} was not found.`,
    );
  }
}
