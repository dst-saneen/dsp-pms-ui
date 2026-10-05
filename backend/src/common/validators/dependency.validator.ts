import { Injectable } from '@nestjs/common';

import { DependencyExistsException } from '../exceptions';

export interface DependencyCheck {
  /**
   * Name of the dependent entity.
   * Example: Employees
   */
  dependency: string;

  /**
   * Repository that supports count().
   */
  repository: {
    count(args?: any): Promise<number>;
  };

  /**
   * Count filter.
   */
  where: Record<string, unknown>;
}

@Injectable()
export class DependencyValidator {
  async validate(checks: DependencyCheck[]): Promise<void> {
    for (const check of checks) {
      const count = await check.repository.count({
        where: check.where,
      });

      if (count > 0) {
        throw new DependencyExistsException('Record', check.dependency);
      }
    }
  }
}
