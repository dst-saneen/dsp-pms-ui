import { Injectable } from '@nestjs/common';

export interface SummaryRepository {
  count(args?: any): Promise<number>;
}

export interface SummaryResult {
  total: number;
  active?: number;
  inactive?: number;
}

@Injectable()
export class SummaryHelper {
  /**
   * Standard Active/Inactive summary.
   * Used by most ERP master tables.
   */
  async getStatusSummary(
    repository: SummaryRepository,
    activeField = 'isActive',
  ): Promise<SummaryResult> {
    const [total, active, inactive] = await Promise.all([
      repository.count(),

      repository.count({
        where: {
          [activeField]: true,
        },
      }),

      repository.count({
        where: {
          [activeField]: false,
        },
      }),
    ]);

    return {
      total,
      active,
      inactive,
    };
  }

  /**
   * Total only.
   */
  async getTotal(repository: SummaryRepository): Promise<SummaryResult> {
    return {
      total: await repository.count(),
    };
  }

  /**
   * Generic summary.
   * Useful for future modules.
   */
  async getSummary(
    repository: SummaryRepository,
    counters: Record<string, Record<string, unknown>>,
  ): Promise<Record<string, number>> {
    const result: Record<string, number> = {};

    const entries = Object.entries(counters);

    await Promise.all(
      entries.map(async ([key, where]) => {
        result[key] = await repository.count({
          where,
        });
      }),
    );

    return result;
  }
}
