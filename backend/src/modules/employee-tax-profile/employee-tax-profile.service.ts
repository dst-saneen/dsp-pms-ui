import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateEmployeeTaxProfileDto } from './dto/create-employee-tax-profile.dto';
import { UpdateEmployeeTaxProfileDto } from './dto/update-employee-tax-profile.dto';

@Injectable()
export class EmployeeTaxProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateEmployeeTaxProfileDto) {
    const existing = await this.prisma.employeeTaxProfile.findFirst({
      where: {
        employeeId: dto.employeeId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException('Tax profile already exists');
    }

    return this.prisma.employeeTaxProfile.create({
      data: {
        companyId: dto.companyId,
        employeeId: dto.employeeId,
        countryCode: dto.countryCode.trim().toUpperCase(),
        taxRegime: dto.taxRegime,
        monthlyTaxAmount: dto.monthlyTaxAmount ?? 0,
      },
      include: {
        company: true,
        employee: true,
      },
    });
  }

  async findAll() {
    return this.prisma.employeeTaxProfile.findMany({
      where: {
        isActive: true,
      },
      include: {
        company: true,
        employee: true,
      },
      orderBy: {
        countryCode: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.employeeTaxProfile.findUnique({
      where: { id },
      include: {
        company: true,
        employee: true,
      },
    });

    if (!profile || !profile.isActive) {
      throw new NotFoundException('Tax profile not found');
    }

    return profile;
  }

  async update(id: string, dto: UpdateEmployeeTaxProfileDto) {
    await this.findOne(id);

    return this.prisma.employeeTaxProfile.update({
      where: { id },
      data: {
        countryCode: dto.countryCode
          ? dto.countryCode.trim().toUpperCase()
          : undefined,

        taxRegime: dto.taxRegime,

        monthlyTaxAmount: dto.monthlyTaxAmount,
      },
      include: {
        company: true,
        employee: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.employeeTaxProfile.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }
}
