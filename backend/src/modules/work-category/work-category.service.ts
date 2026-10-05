import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateWorkCategoryDto } from './dto/create-work-category.dto';
import { UpdateWorkCategoryDto } from './dto/update-work-category.dto';

@Injectable()
export class WorkCategoryService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWorkCategoryDto) {
    const existing = await this.prisma.workCategory.findFirst({
      where: {
        companyId: dto.companyId ?? null,
        categoryCode: dto.categoryCode,
      },
    });

    if (existing) {
      throw new ConflictException('Category code already exists');
    }

    return this.prisma.workCategory.create({
      data: {
        categoryCode: dto.categoryCode,
        categoryName: dto.categoryName,
        companyId: dto.companyId,
        isBillable: dto.isBillable ?? true,
      },
    });
  }

  async findAll() {
    return this.prisma.workCategory.findMany({
      orderBy: {
        categoryName: 'asc',
      },
    });
  }

  async findOne(id: string) {}

  async update(id: string, dto: UpdateWorkCategoryDto) {}

  async remove(id: string) {}
}
