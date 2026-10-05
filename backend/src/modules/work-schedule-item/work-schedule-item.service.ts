import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateWorkScheduleItemDto } from './dto/create-work-schedule-item.dto';
import { UpdateWorkScheduleItemDto } from './dto/update-work-schedule-item.dto';
import { WorkExecutionStatus } from '@prisma/client';

@Injectable()
export class WorkScheduleItemService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateWorkScheduleItemDto) {
    const schedule = await this.prisma.workSchedule.findUnique({
      where: { id: dto.workScheduleId },
    });
    if (!schedule) throw new NotFoundException('Work schedule not found');

    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employeeId },
    });
    if (!employee) throw new NotFoundException('Employee not found');

    if (dto.taskId) {
      const task = await this.prisma.projectTask.findUnique({
        where: { id: dto.taskId },
      });
      if (!task) throw new NotFoundException('Task not found');
    }

    return this.prisma.workScheduleItem.create({
      data: {
        workScheduleId: dto.workScheduleId,
        employeeId: dto.employeeId,
        workDate: new Date(dto.workDate),
        taskId: dto.taskId,
        workCategoryId: dto.workCategoryId,
        title: dto.title,
        description: dto.description,
        plannedHours: dto.plannedHours,
        sourceType: 'MANUAL_SCHEDULE',
      },
    });
  }

  async getCurrentEmployeeWorkItem(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.workScheduleItem.findFirst({
      where: {
        employeeId,
        workDate: { gte: today, lt: tomorrow },
      },
      include: {
        workSchedule: true,
        task: { include: { project: true, stage: true } },
        workCategory: true,
        employee: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getEmployeeTodayItems(employeeId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.workScheduleItem.findMany({
      where: {
        employeeId,
        workDate: { gte: today, lt: tomorrow },
      },
      include: {
        task: { include: { project: true, stage: true } },
        workCategory: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getEmployeeNextWorkItem(employeeId: string) {
    const current = await this.getCurrentEmployeeWorkItem(employeeId);
    if (!current) return null;

    return this.prisma.workScheduleItem.findFirst({
      where: {
        employeeId,
        workDate: current.workDate,
        createdAt: { gt: current.createdAt },
      },
      include: {
        task: { include: { project: true, stage: true } },
        workCategory: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findById(id: string) {
    const item = await this.prisma.workScheduleItem.findUnique({
      where: { id },
      include: {
        task: true,
        employee: true,
        workCategory: true,
        childItems: true,
      },
    });
    if (!item) throw new NotFoundException('Work schedule item not found');
    return item;
  }

  async findBySchedule(workScheduleId: string) {
    return this.prisma.workScheduleItem.findMany({
      where: { workScheduleId },
      include: { task: true, employee: true, workCategory: true },
      orderBy: { workDate: 'asc' },
    });
  }

  async getEmployeeTaskSummary(employeeId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const [assigned, dueToday] = await Promise.all([
      this.prisma.workScheduleItem.count({
        where: {
          employeeId,
          status: { not: WorkExecutionStatus.CANCELLED },
        },
      }),
      this.prisma.workScheduleItem.count({
        where: {
          employeeId,
          workDate: { gte: start, lte: end },
          status: { not: WorkExecutionStatus.CANCELLED },
        },
      }),
    ]);

    return { assigned, dueToday };
  }

  async getEmployeeActiveProjectCount(employeeId: string) {
    // Example implementation: count distinct active projects linked to employee's tasks
    const projects = await this.prisma.project.findMany({
      where: {
        tasks: {
          some: {
            workScheduleItems: {
              some: {
                employeeId,
                status: { not: WorkExecutionStatus.CANCELLED },
              },
            },
          },
        },
        status: 'ACTIVE',
      },
    });
    return projects.length;
  }

  async update(id: string, dto: UpdateWorkScheduleItemDto) {
    await this.findById(id);
    return this.prisma.workScheduleItem.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    await this.findById(id);
    return this.prisma.workScheduleItem.delete({ where: { id } });
  }
}
