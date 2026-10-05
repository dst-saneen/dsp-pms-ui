import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TemplateVersionReader {
  constructor(private readonly prisma: PrismaService) {}

  async findById(templateVersionId: string) {
    const version = await this.prisma.onboardingTemplateVersion.findUnique({
      where: {
        id: templateVersionId,
      },
      include: {
        onboardingTemplate: true,
      },
    });

    if (!version) {
      throw new NotFoundException(
        `Template version '${templateVersionId}' not found.`,
      );
    }

    return version;
  }
}
