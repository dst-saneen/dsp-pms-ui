import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ProjectTaskValidationService {
  constructor(private readonly prisma: PrismaService) {}

  async validateTask(taskId: string) {
    const task = await this.prisma.projectTask.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        stage: true,
        taskType: true,
      },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async validateProject(projectId: string) {
    const project = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async validateStage(projectId: string, stageId: string) {
    const stage = await this.prisma.projectStage.findUnique({
      where: {
        id: stageId,
      },
    });

    if (!stage) {
      throw new NotFoundException('Project stage not found');
    }

    if (stage.projectId !== projectId) {
      throw new BadRequestException(
        'Stage does not belong to the selected project',
      );
    }

    return stage;
  }

  async validateTaskType(taskTypeId?: string) {
    if (!taskTypeId) {
      return null;
    }

    const taskType = await this.prisma.taskType.findUnique({
      where: {
        id: taskTypeId,
      },
    });

    if (!taskType) {
      throw new NotFoundException('Task type not found');
    }

    if (!taskType.isActive) {
      throw new BadRequestException('Task type is inactive');
    }

    return taskType;
  }

  async validateParentTask(projectId: string, parentTaskId?: string) {
    if (!parentTaskId) {
      return null;
    }

    const parent = await this.prisma.projectTask.findUnique({
      where: {
        id: parentTaskId,
      },
    });

    if (!parent) {
      throw new NotFoundException('Parent task not found');
    }

    if (parent.projectId !== projectId) {
      throw new BadRequestException('Parent task belongs to another project');
    }

    return parent;
  }

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

  async ensureTaskIsOpen(taskId: string) {
    const task = await this.validateTask(taskId);

    if (task.status !== 'OPEN') {
      throw new BadRequestException(
        `Task is ${task.status}. Operation is not allowed.`,
      );
    }

    return task;
  }

  async ensureUniqueTaskCode(
    projectId: string,
    taskCode: string,
    excludeTaskId?: string,
  ) {
    const existing = await this.prisma.projectTask.findFirst({
      where: {
        projectId,
        taskCode,
        ...(excludeTaskId
          ? {
              NOT: {
                id: excludeTaskId,
              },
            }
          : {}),
      },
    });

    if (existing) {
      throw new BadRequestException('Task code already exists in this project');
    }
  }

  async ensureUniqueTaskName(
    stageId: string,
    taskName: string,
    excludeTaskId?: string,
  ) {
    const existing = await this.prisma.projectTask.findFirst({
      where: {
        stageId,
        taskName,
        ...(excludeTaskId
          ? {
              NOT: {
                id: excludeTaskId,
              },
            }
          : {}),
      },
    });

    if (existing) {
      throw new BadRequestException('Task name already exists in this stage');
    }
  }

  async validateParticipant(taskId: string, employeeId: string, role: string) {
    const participant = await this.prisma.taskParticipant.findFirst({
      where: {
        taskId,
        employeeId,
        role,
      },
    });

    if (participant) {
      throw new BadRequestException(
        'Employee is already assigned with this role',
      );
    }

    return participant;
  }
}
