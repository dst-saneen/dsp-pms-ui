import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateResourceTypeDto } from './dto/create-resource-type.dto';
import { UpdateResourceTypeDto } from './dto/update-resource-type.dto';

@Injectable()
export class ResourceTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceTypeDto) {
    const existing = await this.prisma.resourceType.findFirst({
      where: {
        companyId: dto.companyId,
        name: dto.name,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Resource type already exists');
    }

    return this.prisma.resourceType.create({
      data: {
        companyId: dto.companyId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(companyId?: string) {
    return this.prisma.resourceType.findMany({
      where: {
        companyId,
        isActive: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }
  async findOne(id: string) {
    const record = await this.prisma.resourceType.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException('Resource type not found');
    }

    return record;
  }

  async update(id: string, dto: UpdateResourceTypeDto) {
    const existing = await this.prisma.resourceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Resource type not found');
    }

    if (dto.name) {
      const duplicate = await this.prisma.resourceType.findFirst({
        where: {
          companyId: existing.companyId,
          name: dto.name,
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException('Resource type already exists');
      }
    }

    return this.prisma.resourceType.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.resourceType.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Resource type not found');
    }

    return this.prisma.resourceType.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
