import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExecutionRuleReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByExecutionProfileIds(executionProfileIds: string[]) {
    if (!executionProfileIds.length) {
      return [];
    }

    return this.prisma.executionRule.findMany({
      where: {
        executionProfileId: {
          in: executionProfileIds,
        },
        isActive: true,
      },
      orderBy: {
        sequenceNo: 'asc',
      },
    });
  }
}
