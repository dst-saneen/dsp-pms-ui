import { Inject, Injectable, forwardRef } from '@nestjs/common';

import {
  JobOfferStatus,
  Prisma,
  TaskStatus,
  TemplateVersionStatus,
  WorkOwnerType,
  CareerEventType,
} from '@prisma/client';

import { DomainConflictException, DomainNotFoundException } from '../../common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmployeeDomainScopeService } from '../auth/employee-domain-scope.service';
import { EmployeeLifecycleTransitionService } from '../recruitment/transitions/employee-lifecycle-transition.service';
import { OnboardingFeatureGateService } from '../onboarding-runtime/services/onboarding-feature-gate.service';

import { CreateEmployeeOnboardingDto } from './dto/create-employee-onboarding.dto';
import { UpdateEmployeeOnboardingDto } from './dto/update-employee-onboarding.dto';
import { EmployeeOnboardingQueryDto } from './dto/employee-onboarding-query.dto';
import { EmployeeOnboardingRepository } from './repositories/employee-onboarding.repository';

type VersionWithTasks = Prisma.OnboardingTemplateVersionGetPayload<{
  include: {
    departments: {
      include: {
        department: true;
        taskGroups: {
          include: {
            tasks: {
              include: {
                assignedEmployee: {
                  include: {
                    user: { select: { id: true } };
                  };
                };
              };
            };
          };
        };
      };
    };
  };
}>;

type TemplateTaskRow =
  VersionWithTasks['departments'][number]['taskGroups'][number]['tasks'][number];

const onboardingInclude = {
  employee: true,
  template: true,
  templateVersion: true,
  tasks: {
    orderBy: { sequenceNo: 'asc' as const },
    include: {
      assignedDepartment: {
        select: {
          id: true,
          departmentCode: true,
          departmentName: true,
        },
      },
    },
  },
} satisfies Prisma.EmployeeOnboardingInclude;

@Injectable()
export class EmployeeOnboardingService {
  constructor(
    private readonly employeeOnboardingRepository: EmployeeOnboardingRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly featureGate: OnboardingFeatureGateService,
    @Inject(forwardRef(() => EmployeeLifecycleTransitionService))
    private readonly employeeLifecycleTransition: EmployeeLifecycleTransitionService,
  ) {}

  async create(dto: CreateEmployeeOnboardingDto) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id: dto.employeeId,
        isActive: true,
        ...this.scopeService.employeeWhere(),
      },
      include: {
        user: { select: { id: true } },
        manager: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        'EMPLOYEE_NOT_FOUND',
        'Employee not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const template = await this.prisma.onboardingTemplate.findFirst({
      where: {
        id: dto.templateId,
        companyId: employee.companyId,
        isActive: true,
        ...this.scopeService.onboardingTemplateWhere(),
      },
    });

    if (!template) {
      throw new DomainNotFoundException(
        'ONBOARDING_TEMPLATE_NOT_FOUND',
        'Onboarding template not found.',
      );
    }

    const publishedVersion =
      await this.prisma.onboardingTemplateVersion.findFirst({
        where: {
          onboardingTemplateId: template.id,
          status: TemplateVersionStatus.PUBLISHED,
          isCurrent: true,
        },
      });

    if (!publishedVersion) {
      throw new DomainConflictException(
        'ONBOARDING_TEMPLATE_NOT_PUBLISHED',
        'Onboarding template has no current published version.',
      );
    }

    const existing = await this.prisma.employeeOnboarding.findFirst({
      where: {
        employeeId: dto.employeeId,
        status: TaskStatus.IN_PROGRESS,
        ...this.scopeService.onboardingWhere(),
      },
    });

    if (existing) {
      throw new DomainConflictException(
        'ACTIVE_ONBOARDING_EXISTS',
        'Employee already has an active onboarding.',
      );
    }

    const startDate = new Date(dto.startDate);

    return this.prisma.$transaction(async (tx) =>
      this.snapshotOnboarding(tx, {
        employee,
        templateId: dto.templateId,
        templateVersionId: publishedVersion.id,
        startDate,
        remarks: dto.remarks,
      }),
    );
  }

  async createInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      employeeId: string;
      templateId: string;
      startDate: Date;
      remarks?: string;
    },
  ) {
    const employee = await tx.employee.findUnique({
      where: { id: input.employeeId },
      include: {
        user: { select: { id: true } },
        manager: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!employee) {
      throw new DomainNotFoundException(
        'EMPLOYEE_NOT_FOUND',
        'Employee not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const existing = await tx.employeeOnboarding.findFirst({
      where: {
        employeeId: input.employeeId,
        status: TaskStatus.IN_PROGRESS,
      },
    });

    if (existing) {
      return tx.employeeOnboarding.findUniqueOrThrow({
        where: { id: existing.id },
        include: onboardingInclude,
      });
    }

    const publishedVersion = await tx.onboardingTemplateVersion.findFirst({
      where: {
        onboardingTemplateId: input.templateId,
        status: TemplateVersionStatus.PUBLISHED,
        isCurrent: true,
      },
    });

    if (!publishedVersion) {
      throw new DomainConflictException(
        'ONBOARDING_TEMPLATE_NOT_PUBLISHED',
        'Onboarding template has no current published version.',
      );
    }

    return this.snapshotOnboarding(tx, {
      employee,
      templateId: input.templateId,
      templateVersionId: publishedVersion.id,
      startDate: input.startDate,
      remarks: input.remarks,
    });
  }

  private async snapshotOnboarding(
    tx: Prisma.TransactionClient,
    input: {
      employee: {
        id: string;
        companyId: string;
        branchId: string;
        departmentId: string | null;
        designationId: string | null;
        user: { id: string } | null;
        manager: { user: { id: string } | null } | null;
      };
      templateId: string;
      templateVersionId: string;
      startDate: Date;
      remarks?: string;
    },
  ) {
    const versionWithTasks = await tx.onboardingTemplateVersion.findUnique({
      where: { id: input.templateVersionId },
      include: {
        departments: {
          where: { isActive: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            department: true,
            taskGroups: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
              include: {
                tasks: {
                  orderBy: { sequenceNo: 'asc' },
                  include: {
                    assignedEmployee: {
                      include: {
                        user: { select: { id: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!versionWithTasks) {
      throw new DomainConflictException(
        'ONBOARDING_SNAPSHOT_FAILED',
        'Failed to load published template version for snapshot.',
      );
    }

    const invalidDepartment = versionWithTasks.departments.find(
      (departmentTemplate) =>
        departmentTemplate.department.companyId !== input.employee.companyId ||
        departmentTemplate.department.branchId !== input.employee.branchId,
    );

    if (invalidDepartment) {
      throw new DomainNotFoundException(
        'ONBOARDING_DEPARTMENT_NOT_FOUND',
        'Onboarding department not found.',
      );
    }

    const templateTasks = this.collectTemplateTasks(versionWithTasks);

    const onboarding = await tx.employeeOnboarding.create({
      data: {
        companyId: input.employee.companyId,
        branchId: input.employee.branchId,
        employeeId: input.employee.id,
        departmentIdAtStart: input.employee.departmentId,
        designationIdAtStart: input.employee.designationId,
        templateId: input.templateId,
        templateVersionId: input.templateVersionId,
        startDate: input.startDate,
        remarks: input.remarks,
        status: TaskStatus.IN_PROGRESS,
        totalTasks: templateTasks.length,
        completedTasks: 0,
        progress: 0,
      },
    });

    const sourceToEmployeeTaskId = new Map<string, string>();

    for (const task of templateTasks) {
      const assignedToUserId = this.resolveAssigneeUserId(task, input.employee);

      const dueDate =
        task.dueDays != null
          ? this.addDays(input.startDate, task.dueDays)
          : null;

      const createdTask = await tx.employeeOnboardingTask.create({
        data: {
          onboardingId: onboarding.id,
          companyId: input.employee.companyId,
          branchId: input.employee.branchId,
          employeeId: input.employee.id,
          workstreamDepartmentId: task.assignedDepartmentId,
          executorDepartmentId:
            task.ownerType === WorkOwnerType.DEPARTMENT
              ? task.assignedDepartmentId
              : null,
          templateVersionId: input.templateVersionId,
          taskName: task.taskName,
          description: task.description,
          sequenceNo: task.sequenceNo,
          priority: task.priority,
          isMandatory: task.isMandatory,
          allowSkip: task.allowSkip,
          allowReopen: task.allowReopen,
          workType: task.workType,
          ownerType: task.ownerType,
          referenceType: task.referenceType,
          referenceId: task.referenceId,
          sourceTemplateTaskId: task.id,
          assignedDepartmentId: task.assignedDepartmentId,
          assignedDesignationId: task.assignedDesignationId,
          assignedToUserId,
          dueDate,
          status: TaskStatus.PENDING,
        },
      });

      sourceToEmployeeTaskId.set(task.id, createdTask.id);
    }

    for (const task of templateTasks) {
      if (!task.dependsOnTaskId) {
        continue;
      }

      const employeeTaskId = sourceToEmployeeTaskId.get(task.id);
      const dependsOnEmployeeTaskId = sourceToEmployeeTaskId.get(
        task.dependsOnTaskId,
      );

      if (!employeeTaskId || !dependsOnEmployeeTaskId) {
        throw new DomainConflictException(
          'ONBOARDING_SNAPSHOT_FAILED',
          'Failed to remap task dependencies during snapshot.',
        );
      }

      await tx.employeeOnboardingTask.update({
        where: { id: employeeTaskId },
        data: { dependsOnTaskId: dependsOnEmployeeTaskId },
      });
    }

    const result = await tx.employeeOnboarding.findUniqueOrThrow({
      where: { id: onboarding.id },
      include: onboardingInclude,
    });

    await this.auditService.log(
      'EmployeeOnboarding',
      result.id,
      'CREATE',
      null,
      {
        id: result.id,
        employeeId: result.employeeId,
        templateId: result.templateId,
        templateVersionId: result.templateVersionId,
        status: result.status,
        totalTasks: result.totalTasks,
      },
      { tx },
    );

    await tx.employeeCareerEvent.create({
      data: {
        employeeId: input.employee.id,
        eventType: CareerEventType.ONBOARDING_STARTED,
        eventAt: input.startDate,
        employeeVisibleSummary: 'Onboarding started.',
        sourceModule: 'onboarding',
        sourceRecordId: result.id,
      },
    });

    return result;
  }

  async findAll(query: EmployeeOnboardingQueryDto) {
    await this.featureGate.assertEnabledForContext();

    return this.employeeOnboardingRepository.search(
      query,
      this.scopeService.onboardingWhere(),
    );
  }

  async findOne(id: string) {
    const onboarding = await this.prisma.employeeOnboarding.findFirst({
      where: {
        id,
        ...this.scopeService.onboardingWhere(),
      },
      include: onboardingInclude,
    });

    if (!onboarding) {
      throw new DomainNotFoundException(
        'EMPLOYEE_ONBOARDING_NOT_FOUND',
        'Employee onboarding not found.',
      );
    }

    await this.featureGate.assertEnabledForContext(onboarding.companyId);

    return onboarding;
  }

  async findByEmployee(employeeId: string) {
    const employee = await this.scopeService.assertEmployeeInScope(employeeId);
    await this.featureGate.assertEnabledForContext(
      employee.companyId,
      employee.branchId,
    );

    const onboarding = await this.employeeOnboardingRepository.findByEmployee(
      employeeId,
      this.scopeService.onboardingWhere(),
    );

    if (!onboarding) {
      throw new DomainNotFoundException(
        'EMPLOYEE_ONBOARDING_NOT_FOUND',
        'Employee onboarding not found.',
      );
    }

    return onboarding;
  }

  async update(id: string, dto: UpdateEmployeeOnboardingDto) {
    const existing = await this.findOne(id);

    if (
      existing.status === TaskStatus.COMPLETED ||
      existing.status === TaskStatus.CANCELLED
    ) {
      throw new DomainConflictException(
        'ONBOARDING_NOT_EDITABLE',
        'Completed or cancelled onboarding cannot be updated.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeOnboarding.updateMany({
        where: { id: existing.id, status: existing.status },
        data: { remarks: dto.remarks },
      });

      if (changed.count !== 1) {
        throw new DomainConflictException(
          'ONBOARDING_STATE_CHANGED',
          'Onboarding state changed. Refresh and try again.',
        );
      }

      const onboarding = await tx.employeeOnboarding.findUniqueOrThrow({
        where: { id: existing.id },
      });

      await this.auditService.log(
        'EmployeeOnboarding',
        id,
        'UPDATE',
        { id, remarks: existing.remarks },
        { id, remarks: onboarding.remarks },
        { tx },
      );

      return onboarding;
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);

    if (existing.status === TaskStatus.COMPLETED) {
      throw new DomainConflictException(
        'ONBOARDING_ALREADY_COMPLETED',
        'Completed onboarding cannot be cancelled.',
      );
    }

    if (existing.status === TaskStatus.CANCELLED) {
      throw new DomainConflictException(
        'ONBOARDING_ALREADY_CANCELLED',
        'Onboarding is already cancelled.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.employeeOnboardingTask.updateMany({
        where: {
          onboardingId: id,
          status: {
            notIn: [TaskStatus.COMPLETED, TaskStatus.CANCELLED],
          },
        },
        data: { status: TaskStatus.CANCELLED },
      });

      const changed = await tx.employeeOnboarding.updateMany({
        where: { id, status: existing.status },
        data: { status: TaskStatus.CANCELLED },
      });

      if (changed.count !== 1) {
        throw new DomainConflictException(
          'ONBOARDING_STATE_CHANGED',
          'Onboarding state changed. Refresh and try again.',
        );
      }

      const onboarding = await tx.employeeOnboarding.findUniqueOrThrow({
        where: { id },
        include: onboardingInclude,
      });

      await this.auditService.log(
        'EmployeeOnboarding',
        id,
        'CANCEL',
        { id, status: existing.status },
        { id, status: onboarding.status },
        { tx },
      );

      return onboarding;
    });
  }

  async completeOnboarding(id: string) {
    const onboarding = await this.findOne(id);

    if (onboarding.status === TaskStatus.COMPLETED) {
      throw new DomainConflictException(
        'ONBOARDING_ALREADY_COMPLETED',
        'Onboarding is already completed.',
      );
    }

    if (onboarding.status === TaskStatus.CANCELLED) {
      throw new DomainConflictException(
        'ONBOARDING_CANCELLED',
        'Cancelled onboarding cannot be completed.',
      );
    }

    const pendingMandatoryTasks = onboarding.tasks.filter(
      (task) => task.isMandatory && task.status !== TaskStatus.COMPLETED,
    );

    if (pendingMandatoryTasks.length > 0) {
      throw new DomainConflictException(
        'MANDATORY_TASKS_INCOMPLETE',
        'Mandatory onboarding tasks are incomplete.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const changed = await tx.employeeOnboarding.updateMany({
        where: { id, status: onboarding.status },
        data: {
          status: TaskStatus.COMPLETED,
          statusV2: 'COMPLETED',
          completedDate: new Date(),
          completedAt: new Date(),
          progress: 100,
          version: { increment: 1 },
        },
      });

      if (changed.count !== 1) {
        throw new DomainConflictException(
          'ONBOARDING_STATE_CHANGED',
          'Onboarding state changed. Refresh and try again.',
        );
      }

      const updated = await tx.employeeOnboarding.findUniqueOrThrow({
        where: { id },
        include: onboardingInclude,
      });

      await this.auditService.log(
        'EmployeeOnboarding',
        id,
        'COMPLETE',
        { id, status: onboarding.status },
        { id, status: updated.status, completedDate: updated.completedDate },
        { tx },
      );

      const employee = await tx.employee.findUnique({
        where: { id: onboarding.employeeId },
        select: {
          id: true,
          creationSource: true,
          employmentStatus: true,
        },
      });

      if (
        employee?.creationSource === 'RECRUITMENT' &&
        employee.employmentStatus === 'PENDING_ONBOARDING'
      ) {
        const acceptedOffer = await tx.jobOffer.findFirst({
          where: {
            status: JobOfferStatus.ACCEPTED,
            jobApplication: { employeeId: employee.id },
          },
          orderBy: { versionNo: 'desc' },
          select: { probationDays: true },
        });
        const probationDays = acceptedOffer?.probationDays ?? 90;
        const probationStartDate = new Date();
        const probationPlannedEndDate = new Date(probationStartDate);
        probationPlannedEndDate.setDate(
          probationPlannedEndDate.getDate() + probationDays,
        );

        await this.employeeLifecycleTransition.startProbation(employee.id, {
          probationStartDate,
          probationPlannedEndDate,
          tx,
        });
      }

      await tx.employeeCareerEvent.create({
        data: {
          employeeId: onboarding.employeeId,
          eventType: CareerEventType.ONBOARDING_COMPLETED,
          eventAt: new Date(),
          employeeVisibleSummary: 'Onboarding completed.',
          sourceModule: 'onboarding',
          sourceRecordId: id,
        },
      });

      return updated;
    });
  }

  async getSummary() {
    await this.featureGate.assertEnabledForContext();

    return this.employeeOnboardingRepository.getSummary(
      this.scopeService.onboardingWhere(),
    );
  }

  private collectTemplateTasks(version: VersionWithTasks): TemplateTaskRow[] {
    const tasks: TemplateTaskRow[] = [];

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        tasks.push(...group.tasks);
      }
    }

    return tasks;
  }

  private resolveAssigneeUserId(
    task: TemplateTaskRow,
    employee: {
      user: { id: string } | null;
      manager: { user: { id: string } | null } | null;
    },
  ): string | null {
    if (task.assignedEmployee?.user?.id) {
      return task.assignedEmployee.user.id;
    }

    if (task.ownerType === WorkOwnerType.EMPLOYEE && employee.user?.id) {
      return employee.user.id;
    }

    if (
      task.ownerType === WorkOwnerType.MANAGER &&
      employee.manager?.user?.id
    ) {
      return employee.manager.user.id;
    }

    return null;
  }

  private addDays(startDate: Date, days: number): Date {
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + days);
    return dueDate;
  }
}
