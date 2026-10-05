import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ExecutionProfileReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByContributionIds(contributionIds: string[]) {
    if (!contributionIds.length) {
      return [];
    }

    return this.prisma.executionProfile.findMany({
      where: {
        contributionId: {
          in: contributionIds,
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }
}
