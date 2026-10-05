import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { ShiftFilterDto } from './dto/shift-filter.dto';
import { OrganizationScopeService } from '../auth';
import { NumberSeriesService } from '../number-series';

@Injectable()
export class ShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly numberSeries: NumberSeriesService,
  ) {}

  async create(dto: CreateShiftDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const company = await this.prisma.company.findUnique({
      where: {
        id: dto.companyId,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    const duplicateName = await this.prisma.shift.findFirst({
      where: {
        companyId: dto.companyId,
        shiftName: dto.shiftName,
      },
    });

    if (duplicateName) {
      throw new BadRequestException('Shift name already exists.');
    }

    const shiftCode = await this.numberSeries.next(
      'SHIFT',
      dto.companyId,
      'SHF',
    );
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shift.updateMany({
          where: {
            companyId: dto.companyId,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.shift.create({
        data: {
          companyId: dto.companyId,
          shiftCode,
          shiftName: dto.shiftName,
          startTime: dto.startTime,
          endTime: dto.endTime,
          breakMinutes: dto.breakMinutes ?? 60,
          graceInMinutes: dto.graceInMinutes ?? 15,
          graceOutMinutes: dto.graceOutMinutes ?? 15,
          isNightShift: dto.isNightShift ?? false,
          isDefault: dto.isDefault ?? false,
          remarks: dto.remarks,
          isActive: dto.isActive ?? true,
        },
        include: {
          company: true,
        },
      });
    });
  }

  async findAll(filters: ShiftFilterDto) {
    const scope = this.organizationScope.current();
    const companyId = filters.companyId;

    if (companyId) {
      await this.organizationScope.assertCurrentCompany(companyId);
    }

    const include = {
      company: true,
    } as const;

    const activeFilter =
      filters.isActive !== undefined ? { isActive: filters.isActive } : {};

    // Company Group owners/admins: list all Shifts in the Group unless a
    // company filter is supplied. Do not hide other companies' Shifts because
    // of workspace activeCompanyId.
    if (
      !scope.isGlobal &&
      scope.scopeLevel === 'COMPANY_GROUP' &&
      scope.activeCompanyGroupId
    ) {
      return this.prisma.shift.findMany({
        where: {
          ...(companyId
            ? { companyId }
            : {
                company: {
                  companyGroupId: scope.activeCompanyGroupId,
                },
              }),
          ...activeFilter,
        },
        include,
        orderBy: [
          {
            company: {
              companyName: 'asc',
            },
          },
          {
            shiftName: 'asc',
          },
        ],
      });
    }

    const scopedCompanyId =
      companyId ?? this.organizationScope.companyIdOrUndefined();

    return this.prisma.shift.findMany({
      where: {
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        ...activeFilter,
      },
      include,
      orderBy: [
        {
          company: {
            companyName: 'asc',
          },
        },
        {
          shiftName: 'asc',
        },
      ],
    });
  }

  async findOne(id: string) {
    const scope = this.organizationScope.current();

    if (
      !scope.isGlobal &&
      scope.scopeLevel === 'COMPANY_GROUP' &&
      scope.activeCompanyGroupId
    ) {
      const shift = await this.prisma.shift.findFirst({
        where: {
          id,
          company: {
            companyGroupId: scope.activeCompanyGroupId,
          },
        },
        include: {
          company: true,
        },
      });

      if (!shift) {
        throw new NotFoundException('Shift not found.');
      }

      return shift;
    }

    const companyId = this.organizationScope.companyIdOrUndefined();
    const shift = await this.prisma.shift.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
      },
      include: {
        company: true,
      },
    });

    if (!shift) {
      throw new NotFoundException('Shift not found.');
    }

    return shift;
  }

  async update(id: string, dto: UpdateShiftDto) {
    const shift = await this.findOne(id);

    const companyId = dto.companyId ?? shift.companyId;

    if (dto.companyId) {
      await this.organizationScope.assertCurrentCompany(dto.companyId);
      const company = await this.prisma.company.findUnique({
        where: {
          id: dto.companyId,
        },
      });

      if (!company) {
        throw new NotFoundException('Company not found.');
      }
    }

    if (dto.shiftName) {
      const duplicate = await this.prisma.shift.findFirst({
        where: {
          companyId,
          shiftName: dto.shiftName,
          NOT: {
            id,
          },
        },
      });

      if (duplicate) {
        throw new BadRequestException('Shift name already exists.');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.shift.updateMany({
          where: {
            companyId,
            isDefault: true,
            NOT: {
              id,
            },
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.shift.update({
        where: {
          id,
        },
        data: dto,
        include: {
          company: true,
        },
      });
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.shift.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
