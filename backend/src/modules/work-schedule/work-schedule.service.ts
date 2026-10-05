import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

import { CreateWorkScheduleDto } from './dto/create-work-schedule.dto';
import { UpdateWorkScheduleDto } from './dto/update-work-schedule.dto';

@Injectable()
export class WorkScheduleService {
  constructor(private prisma: PrismaService) {}

  getCurrentWeek(employeeId: string): Promise<void> {
    void employeeId;
    return Promise.resolve();
  }
  async create(dto: CreateWorkScheduleDto) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: dto.employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const existing = await this.prisma.workSchedule.findFirst({
      where: {
        employeeId: dto.employeeId,
        startDate: new Date(dto.weekStartDate),
        endDate: new Date(dto.weekEndDate),
      },
    });

    if (existing) {
      throw new ConflictException('Work schedule already exists for this week');
    }

    return this.prisma.workSchedule.create({
      data: {
        employeeId: dto.employeeId,
        startDate: new Date(dto.weekStartDate),
        endDate: new Date(dto.weekEndDate),
        remarks: dto.remarks,
      },
    });
  }

  async findAll() {
    return this.prisma.workSchedule.findMany({
      include: {
        employee: true,
        items: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async findByEmployee(employeeId: string) {
    return this.prisma.workSchedule.findMany({
      where: {
        employeeId,
      },
      include: {
        items: true,
      },
      orderBy: {
        startDate: 'desc',
      },
    });
  }

  async findById(id: string) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id },
      include: {
        employee: true,
        items: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Work schedule not found');
    }

    return schedule;
  }

  async update(id: string, dto: UpdateWorkScheduleDto) {
    await this.findById(id);

    return this.prisma.workSchedule.update({
      where: { id },
      data: {
        startDate: dto.weekStartDate ? new Date(dto.weekStartDate) : undefined,
        endDate: dto.weekEndDate ? new Date(dto.weekEndDate) : undefined,
        remarks: dto.remarks,
      },
    });
  }

  async remove(id: string) {
    await this.findById(id);

    return this.prisma.workSchedule.delete({
      where: { id },
    });
  }
}
