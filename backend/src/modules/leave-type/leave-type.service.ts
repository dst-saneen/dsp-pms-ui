import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../auth';
import { CreateLeaveTypeDto } from './dto/create-leave-type.dto';
import { LeaveTypeCategory, Prisma } from '@prisma/client';
import { LeaveTypeFilterDto } from './dto/leave-type-filter.dto';
import { UpdateLeaveTypeDto } from './dto/update-leave-type.dto';

@Injectable()
export class LeaveTypeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly employeeDomainScope: EmployeeDomainScopeService,
  ) {}

  /** e.g. Casual Leave → CL; Sick → SICK */
  private codeFromName(leaveName: string): string {
    const words = leaveName
      .trim()
      .split(/\s+/)
      .map((word) => word.replace(/[^A-Za-z0-9]/g, ''))
      .filter(Boolean);
    if (words.length >= 2) {
      return words
        .map((word) => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 12);
    }
    const single = (words[0] ?? 'LEAVE').toUpperCase().slice(0, 12);
    return single || 'LEAVE';
  }

  private async allocateUniqueCode(
    companyId: string,
    preferred: string,
  ): Promise<string> {
    const base = preferred.replace(/[^A-Z0-9_]/gi, '').toUpperCase() || 'LEAVE';
    const candidate = base.slice(0, 12);
    // Include inactive rows — soft-deleted codes still occupy the unique index.
    const existing = await this.prisma.leaveType.findFirst({
      where: { companyId, leaveCode: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;

    for (let suffix = 2; suffix <= 99; suffix += 1) {
      const next = `${candidate.slice(0, 10)}${suffix}`.slice(0, 12);
      const clash = await this.prisma.leaveType.findFirst({
        where: { companyId, leaveCode: next },
        select: { id: true },
      });
      if (!clash) return next;
    }
    throw new BadRequestException(
      'Could not allocate a unique leave code. Try a different name.',
    );
  }

  private normalizeCategoryFlags(
    category: LeaveTypeCategory | undefined,
    flags: {
      isPaid: boolean;
      requiresApproval: boolean;
      allowHalfDay: boolean;
      carryForwardAllowed: boolean;
    },
  ) {
    if (category === LeaveTypeCategory.OPTIONAL_HOLIDAY) {
      return {
        isPaid: true,
        // Company chooses approval vs auto-approve on the leave type.
        requiresApproval: flags.requiresApproval,
        allowHalfDay: false,
        carryForwardAllowed: false,
      };
    }
    return flags;
  }

  private preferredLeaveCode(leaveName: string, leaveCode?: string): string {
    const preferred =
      leaveCode?.trim().toUpperCase() || this.codeFromName(leaveName);
    return preferred.replace(/[^A-Z0-9_]/gi, '').toUpperCase().slice(0, 12) || 'LEAVE';
  }

  async create(dto: CreateLeaveTypeDto) {
    await this.employeeDomainScope.assertCompanyInScope(dto.companyId);

    const leaveName = dto.leaveName.trim();
    const providedCode = dto.leaveCode?.trim().toUpperCase();
    const preferredCode = this.preferredLeaveCode(leaveName, providedCode);
    const category = dto.category ?? LeaveTypeCategory.STANDARD;
    const flags = this.normalizeCategoryFlags(category, {
      isPaid: dto.isPaid,
      requiresApproval: dto.requiresApproval,
      allowHalfDay: dto.allowHalfDay,
      carryForwardAllowed: dto.carryForwardAllowed,
    });

    // Soft-delete keeps the unique leaveCode. Recreating the same type
    // should reactivate that row instead of inserting a duplicate.
    const inactive = await this.prisma.leaveType.findFirst({
      where: {
        companyId: dto.companyId,
        isActive: false,
        OR: [
          { leaveCode: preferredCode },
          {
            leaveName: {
              equals: leaveName,
              mode: 'insensitive',
            },
          },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (inactive) {
      return this.prisma.leaveType.update({
        where: { id: inactive.id },
        data: {
          isActive: true,
          leaveCode: inactive.leaveCode,
          leaveName,
          description: dto.description?.trim(),
          category,
          ...flags,
        },
      });
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const leaveCode = await this.allocateUniqueCode(
        dto.companyId,
        preferredCode,
      );
      try {
        return await this.prisma.leaveType.create({
          data: {
            companyId: dto.companyId,
            leaveCode,
            leaveName,
            description: dto.description?.trim(),
            category,
            ...flags,
          },
        });
      } catch (error) {
        if (!this.isUniqueCodeConflict(error)) throw error;
        if (providedCode) {
          throw new BadRequestException({
            code: 'LEAVE_TYPE_CODE_EXISTS',
            message:
              'A leave type with this code already exists (including deleted). Try again or use a different name.',
          });
        }
      }
    }

    throw new BadRequestException(
      'Could not allocate a unique leave code. Try a different name.',
    );
  }

  async findAll(filters: LeaveTypeFilterDto) {
    const where: Prisma.LeaveTypeWhereInput = {
      isActive: true,
      ...this.employeeDomainScope.leaveTypeWhere(),
    };

    if (filters.companyId) {
      where.companyId = filters.companyId;
    }

    return this.prisma.leaveType.findMany({
      where,
      include: {
        company: {
          select: {
            id: true,
            companyCode: true,
            companyName: true,
          },
        },
      },
      orderBy: {
        leaveName: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const leaveType = await this.prisma.leaveType.findFirst({
      where: {
        id,
        isActive: true,
        ...this.employeeDomainScope.leaveTypeWhere(),
      },
      include: {
        company: true,
      },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    return leaveType;
  }

  async update(id: string, dto: UpdateLeaveTypeDto) {
    const leaveType = await this.findOne(id);

    if (dto.leaveCode) {
      const existing = await this.prisma.leaveType.findFirst({
        where: {
          companyId: leaveType.companyId,
          leaveCode: dto.leaveCode.trim().toUpperCase(),
          id: {
            not: id,
          },
        },
      });

      if (existing) {
        throw new BadRequestException('Leave code already exists');
      }
    }

    const category = dto.category ?? leaveType.category;
    const flags = this.normalizeCategoryFlags(category, {
      isPaid: dto.isPaid ?? leaveType.isPaid,
      requiresApproval: dto.requiresApproval ?? leaveType.requiresApproval,
      allowHalfDay: dto.allowHalfDay ?? leaveType.allowHalfDay,
      carryForwardAllowed:
        dto.carryForwardAllowed ?? leaveType.carryForwardAllowed,
    });

    return this.prisma.leaveType.update({
      where: { id },
      data: {
        ...dto,
        leaveCode: dto.leaveCode
          ? dto.leaveCode.trim().toUpperCase()
          : undefined,
        leaveName: dto.leaveName ? dto.leaveName.trim() : undefined,
        description: dto.description ? dto.description.trim() : undefined,
        category,
        ...flags,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.leaveType.update({
      where: { id },
      data: {
        isActive: false,
      },
    });
  }

  private isUniqueCodeConflict(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
