import { ConflictException } from '@nestjs/common';

export class DependencyExistsException extends ConflictException {
  constructor(entity: string, dependency?: string) {
    super(
      dependency
        ? `${entity} cannot be deleted because it is referenced by ${dependency}.`
        : `${entity} cannot be deleted because dependent records exist.`,
    );
  }
}
