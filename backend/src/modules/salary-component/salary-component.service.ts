import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateSalaryComponentDto } from './dto/create-salary-component.dto';
import { UpdateSalaryComponentDto } from './dto/update-salary-component.dto';

@Injectable()
export class SalaryComponentService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateSalaryComponentDto) {
    const existing = await this.prisma.salaryComponent.findFirst({
      where: {
        companyId: dto.companyId,
        componentCode: dto.componentCode.trim().toUpperCase(),
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Salary component code already exists');
    }

    return this.prisma.salaryComponent.create({
      data: {
        companyId: dto.companyId,
        componentCode: dto.componentCode.trim().toUpperCase(),
        componentName: dto.componentName.trim(),
        componentType: dto.componentType.trim().toUpperCase(),
        description: dto.description,
      },
    });
  }

  async findAll() {
    return this.prisma.salaryComponent.findMany({
      where: {
        isActive: true,
      },
      include: {
        company: true,
      },
      orderBy: {
        componentName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const component = await this.prisma.salaryComponent.findUnique({
      where: { id },
      include: {
        company: true,
      },
    });

    if (!component || !component.isActive) {
      throw new NotFoundException('Salary component not found');
    }

    return component;
  }

  async update(id: string, dto: UpdateSalaryComponentDto) {
    const existing = await this.findOne(id);

    if (dto.componentCode) {
      const duplicate = await this.prisma.salaryComponent.findFirst({
        where: {
          companyId: existing.companyId,
          componentCode: dto.componentCode.trim().toUpperCase(),
          isActive: true,
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new ConflictException('Salary component code already exists');
      }
    }

    return this.prisma.salaryComponent.update({
      where: { id },
      data: {
        ...dto,
        componentCode: dto.componentCode
          ? dto.componentCode.trim().toUpperCase()
          : undefined,
        componentName: dto.componentName ? dto.componentName.trim() : undefined,
        componentType: dto.componentType
          ? dto.componentType.trim().toUpperCase()
          : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.salaryComponent.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
