import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateResourceDto) {
    const resourceType = await this.prisma.resourceType.findFirst({
      where: {
        companyId: dto.companyId,
        isActive: true,
      },
    });

    if (!resourceType) {
      throw new NotFoundException('Resource type not found');
    }

    const existing = await this.prisma.resource.findFirst({
      where: {
        companyId: dto.companyId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException('Resource already exists');
    }

    return this.prisma.resource.create({
      data: {
        companyId: dto.companyId,
        resourceTypeId: dto.resourceTypeId,
        name: dto.name,
        code: dto.code,
        description: dto.description,
        monthlyCost: dto.monthlyCost,
        isActive: dto.isActive ?? true,
      },
      include: {
        resourceType: true,
      },
    });
  }

  async findAll() {
    return this.prisma.resource.findMany({
      where: {
        isActive: true,
      },
      include: {
        resourceType: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id },
      include: {
        resourceType: true,
      },
    });

    if (!resource) {
      throw new NotFoundException('Resource not found');
    }

    return resource;
  }

  async update(id: string, dto: UpdateResourceDto) {
    const existing = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    if (dto.resourceTypeId) {
      const resourceType = await this.prisma.resourceType.findFirst({
        where: {
          id: dto.resourceTypeId,
          companyId: existing.companyId,
          isActive: true,
        },
      });

      if (!resourceType) {
        throw new NotFoundException('Resource type not found');
      }
    }

    if (dto.name) {
      const duplicate = await this.prisma.resource.findFirst({
        where: {
          companyId: existing.companyId,
          name: dto.name,
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException('Resource already exists');
      }
    }

    return this.prisma.resource.update({
      where: { id },
      data: dto,
      include: {
        resourceType: true,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.resource.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Resource not found');
    }

    return this.prisma.resource.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
