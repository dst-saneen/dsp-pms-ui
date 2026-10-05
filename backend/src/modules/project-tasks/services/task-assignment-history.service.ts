import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TaskAssignmentHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async recordAssignment(
    taskId: string,
    employeeId: string,
    role: string,
    remarks?: string,
    assignedById?: string,
  ) {
    return this.prisma.taskAssignmentHistory.create({
      data: {
        taskId,
        employeeId,
        role,
        action: 'ASSIGN',
        remarks,
        assignedById,
      },
    });
  }

  async recordReassignment(
    taskId: string,
    previousEmployeeId: string,
    employeeId: string,
    role: string,
    remarks?: string,
    assignedById?: string,
  ) {
    return this.prisma.taskAssignmentHistory.create({
      data: {
        taskId,
        employeeId,
        previousEmployeeId,
        role,
        action: 'REASSIGN',
        remarks,
        assignedById,
      },
    });
  }

  async recordRoleChange(
    taskId: string,
    employeeId: string,
    role: string,
    remarks?: string,
    assignedById?: string,
  ) {
    return this.prisma.taskAssignmentHistory.create({
      data: {
        taskId,
        employeeId,
        role,
        action: 'ROLE_CHANGED',
        remarks,
        assignedById,
      },
    });
  }

  async recordRemoval(
    taskId: string,
    employeeId: string,
    role: string,
    remarks?: string,
    assignedById?: string,
  ) {
    return this.prisma.taskAssignmentHistory.create({
      data: {
        taskId,
        employeeId,
        role,
        action: 'REMOVE',
        remarks,
        assignedById,
      },
    });
  }

  async findByTask(taskId: string) {
    return this.prisma.taskAssignmentHistory.findMany({
      where: {
        taskId,
      },
      include: {
        employee: true,
        previousEmployee: true,
        assignedBy: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
