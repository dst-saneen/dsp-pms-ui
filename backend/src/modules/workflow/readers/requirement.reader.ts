import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class RequirementReader {
  constructor(private readonly prisma: PrismaService) {}

  async findByContributionIds(contributionIds: string[]) {
    if (!contributionIds.length) {
      return [];
    }

    return this.prisma.requirement.findMany({
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
