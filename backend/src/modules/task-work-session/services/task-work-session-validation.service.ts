import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { TaskStatus } from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TaskWorkSessionValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateEmployee(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: {
        id: employeeId,
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    if (!employee.isActive) {
      throw new BadRequestException('Employee is inactive');
    }

    return employee;
  }

  async validateWorkScheduleItem(workScheduleItemId: string) {
    const item = await this.prisma.workScheduleItem.findUnique({
      where: {
        id: workScheduleItemId,
      },
      include: {
        task: true,
        employee: true,
      },
    });

    if (!item) {
      throw new NotFoundException('Work schedule item not found');
    }

    return item;
  }

  async validateAssignment(workScheduleItemId: string, employeeId: string) {
    const item = await this.validateWorkScheduleItem(workScheduleItemId);

    if (item.employeeId !== employeeId) {
      throw new BadRequestException(
        'Work schedule item is assigned to another employee',
      );
    }

    return item;
  }

  async ensureNoActiveSession(employeeId: string) {
    const session = await this.prisma.taskWorkSession.findFirst({
      where: {
        employeeId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    if (session) {
      throw new BadRequestException(
        'Employee already has an active work session',
      );
    }
  }

  /**
   * Placeholder.
   *
   * Attendance integration will come later.
   */
  validateAttendance(_employeeId: string): boolean {
    void _employeeId;
    return true;
  }

  async validateRuntimeStart(employeeId: string, workScheduleItemId: string) {
    await this.validateEmployee(employeeId);

    await this.validateAssignment(workScheduleItemId, employeeId);

    await this.ensureNoActiveSession(employeeId);

    this.validateAttendance(employeeId);
  }
}
