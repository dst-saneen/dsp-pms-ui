import { Injectable } from '@nestjs/common';
import {
  AssetTrackingMode,
  Prisma,
  ReferenceType,
  WorkType,
} from '@prisma/client';

import { DomainNotFoundException } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmployeeDomainScopeService } from '../../auth/employee-domain-scope.service';
import { OnboardingTemplateScopeService } from './onboarding-template-scope.service';

import {
  ValidationMessageContract,
  ValidationResultContract,
} from '../contracts';
import { ONBOARDING_TEMPLATE_ERROR_CODES } from '../constants';

const SUPPORTED_WORK_TYPES = new Set<WorkType>([
  WorkType.CHECKLIST,
  WorkType.ASSET,
]);

const RUNTIME_SUPPORTED_OWNERS = new Set(['DEPARTMENT', 'EMPLOYEE', 'MANAGER']);

const versionInclude = {
  onboardingTemplate: true,
  scopes: true,
  departments: {
    include: {
      department: true,
      taskGroups: {
        include: {
          tasks: {
            include: {
              assignedDepartment: true,
              assignedDesignation: true,
              assignedEmployee: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OnboardingTemplateVersionInclude;

type VersionPayload = Prisma.OnboardingTemplateVersionGetPayload<{
  include: typeof versionInclude;
}>;

@Injectable()
export class OnboardingTemplateValidationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeService: EmployeeDomainScopeService,
    private readonly templateScope: OnboardingTemplateScopeService,
  ) {}

  async validate(versionId: string): Promise<ValidationResultContract> {
    const version = await this.loadVersion(versionId);
    await this.ensureDesignationScope(version);

    const errors: ValidationMessageContract[] = [];
    const warnings: ValidationMessageContract[] = [];

    // Reload after possible scope heal so validateScopes sees it.
    const current = await this.loadVersion(versionId);

    this.validateTemplateActive(current, errors);
    this.validateScopes(current, errors);
    this.validateActiveDepartments(current, errors);
    this.validateActiveTaskGroups(current, errors);
    this.validateTasks(current, errors);
    this.validateSequenceNumbers(current, errors);
    this.validateAssignments(current, errors);
    this.validateDependencies(current, errors);
    this.validateDependencyCycles(current, errors);
    await this.validateCompanyReferences(current, errors);
    await this.validateAssetTasks(current, errors);
    this.validateWorkTypes(current, errors);

    return this.buildResult(errors, warnings);
  }

  /**
   * Designation-driven templates (created from Onboarding Templates list) often
   * miss an applicable scope row. Heal that before validation so HR can publish.
   */
  private async ensureDesignationScope(version: VersionPayload) {
    const activeScopes = version.scopes.filter((scope) => scope.isActive);
    if (activeScopes.length > 0) {
      return;
    }

    const designation = await this.prisma.designation.findFirst({
      where: {
        onboardingTemplateId: version.onboardingTemplateId,
        isActive: true,
      },
      select: {
        id: true,
        companyId: true,
        designationName: true,
      },
    });

    if (!designation) {
      return;
    }

    await this.prisma.onboardingTemplateScope.create({
      data: {
        onboardingTemplateVersionId: version.id,
        companyId: designation.companyId,
        designationId: designation.id,
        priority: 100,
        isActive: true,
        description: `Applies to ${designation.designationName}`,
      },
    });
  }

  private async loadVersion(versionId: string) {
    await this.templateScope.requireVersion(versionId);

    const version = await this.prisma.onboardingTemplateVersion.findFirst({
      where: {
        id: versionId,
        ...this.scopeService.onboardingTemplateVersionWhere(),
      },
      include: versionInclude,
    });

    if (!version) {
      throw new DomainNotFoundException(
        'ONBOARDING_TEMPLATE_VERSION_NOT_FOUND',
        'Template version not found.',
      );
    }

    return version;
  }

  private buildResult(
    errors: ValidationMessageContract[],
    warnings: ValidationMessageContract[],
  ): ValidationResultContract {
    return {
      valid: errors.length === 0,
      errorCount: errors.length,
      warningCount: warnings.length,
      errors,
      warnings,
    };
  }

  private validateTemplateActive(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    if (!version.onboardingTemplate.isActive) {
      errors.push({
        code: 'TEMPLATE_INACTIVE',
        path: 'template',
        message: 'Onboarding template must be active to publish.',
      });
    }
  }

  private validateScopes(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const activeScopes = version.scopes.filter((scope) => scope.isActive);

    if (activeScopes.length === 0) {
      errors.push({
        code: 'NO_ACTIVE_SCOPE',
        path: 'scopes',
        message: 'At least one active applicable scope is required.',
      });
    }
  }

  private validateActiveDepartments(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const activeDepartments = version.departments.filter(
      (department) => department.isActive,
    );

    if (activeDepartments.length === 0) {
      errors.push({
        code: 'NO_ACTIVE_DEPARTMENT',
        path: 'departments',
        message: 'At least one active department is required.',
      });
    }
  }

  private validateActiveTaskGroups(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    let hasActiveTaskGroup = false;

    for (const department of version.departments) {
      if (!department.isActive) {
        continue;
      }

      for (const group of department.taskGroups) {
        if (group.isActive && group.tasks.length > 0) {
          hasActiveTaskGroup = true;
          break;
        }
      }

      if (hasActiveTaskGroup) {
        break;
      }
    }

    if (!hasActiveTaskGroup) {
      errors.push({
        code: 'NO_ACTIVE_TASK_GROUP',
        path: 'taskGroups',
        message: 'At least one active task group with tasks is required.',
      });
    }
  }

  private validateTasks(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    for (const department of version.departments) {
      if (!department.isActive) {
        continue;
      }

      for (const group of department.taskGroups) {
        if (!group.isActive) {
          continue;
        }

        if (group.tasks.length === 0) {
          errors.push({
            code: 'NO_TASKS',
            path: group.groupName,
            message: 'Active task group has no tasks.',
          });
        }
      }
    }
  }

  private validateSequenceNumbers(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        const seen = new Set<number>();

        for (const task of group.tasks) {
          if (seen.has(task.sequenceNo)) {
            errors.push({
              code: 'DUPLICATE_SEQUENCE',
              path: group.groupName,
              message: `Duplicate sequence number ${task.sequenceNo}.`,
            });
          }

          seen.add(task.sequenceNo);
        }
      }
    }
  }

  private validateAssignments(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const companyId = version.onboardingTemplate.companyId;
    const prerequisiteIds = new Set<string>();

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (task.dependsOnTaskId) {
            prerequisiteIds.add(task.dependsOnTaskId);
          }
        }
      }
    }

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (!task.ownerType) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_OWNER_REQUIRED,
              path: task.taskName,
              message: 'Every onboarding task requires an owner type.',
            });
          } else if (!RUNTIME_SUPPORTED_OWNERS.has(task.ownerType)) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_OWNER_UNSUPPORTED,
              path: task.taskName,
              message: `Owner type ${task.ownerType} is not supported for new templates.`,
            });
          }

          if (
            task.assignedDepartmentId &&
            task.assignedDepartment?.companyId !== companyId
          ) {
            errors.push({
              code: 'ASSIGNMENT_OUT_OF_SCOPE',
              path: task.taskName,
              message:
                'Assigned department does not belong to the template company.',
            });
          }

          if (
            task.assignedDesignationId &&
            task.assignedDesignation?.companyId !== companyId
          ) {
            errors.push({
              code: 'ASSIGNMENT_OUT_OF_SCOPE',
              path: task.taskName,
              message:
                'Assigned designation does not belong to the template company.',
            });
          }

          if (
            task.assignedEmployeeId &&
            task.assignedEmployee?.companyId !== companyId
          ) {
            errors.push({
              code: 'ASSIGNMENT_OUT_OF_SCOPE',
              path: task.taskName,
              message:
                'Named employee assignment is not allowed on published template tasks.',
            });
          }

          if (task.assignedDesignationId || task.assignedEmployeeId) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_NAMED_ASSIGNMENT_FORBIDDEN,
              path: task.taskName,
              message:
                'Published templates must not assign named employees or designations.',
            });
          }

          if (
            task.ownerType === 'DEPARTMENT' &&
            task.assignedDepartmentId !== department.departmentId
          ) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_DEPARTMENT_MISMATCH,
              path: task.taskName,
              message:
                'Department-owned tasks must use their enclosing Department.',
            });
          }

          if (
            (task.ownerType === 'EMPLOYEE' || task.ownerType === 'MANAGER') &&
            task.assignedDepartmentId
          ) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_DEPARTMENT_MISMATCH,
              path: task.taskName,
              message:
                'Employee and Manager tasks cannot have a Department owner.',
            });
          }

          if (task.approvalWorkflowId) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_APPROVAL_NOT_SUPPORTED,
              path: task.taskName,
              message:
                'Approval workflows are not supported on executable onboarding tasks.',
            });
          }

          if (task.allowSkip && prerequisiteIds.has(task.id)) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_SKIPPABLE_PREREQUISITE,
              path: task.taskName,
              message: 'A task used as a prerequisite cannot be skippable.',
            });
          }
        }
      }
    }
  }

  private validateDependencies(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const taskIds = new Set<string>();

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          taskIds.add(task.id);
        }
      }
    }

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (task.dependsOnTaskId && !taskIds.has(task.dependsOnTaskId)) {
            errors.push({
              code: 'INVALID_DEPENDENCY',
              path: task.taskName,
              message: 'Dependency points outside this version.',
            });
          }

          if (task.dependsOnTaskId === task.id) {
            errors.push({
              code: 'SELF_DEPENDENCY',
              path: task.taskName,
              message: 'Task cannot depend on itself.',
            });
          }
        }
      }
    }
  }

  private validateDependencyCycles(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const adjacency = new Map<string, string[]>();
    const taskNames = new Map<string, string>();

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          taskNames.set(task.id, task.taskName);

          if (task.dependsOnTaskId) {
            const dependents = adjacency.get(task.dependsOnTaskId) ?? [];
            dependents.push(task.id);
            adjacency.set(task.dependsOnTaskId, dependents);
          }
        }
      }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();

    const visit = (taskId: string): boolean => {
      if (visiting.has(taskId)) {
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visiting.add(taskId);

      for (const dependentId of adjacency.get(taskId) ?? []) {
        if (visit(dependentId)) {
          return true;
        }
      }

      visiting.delete(taskId);
      visited.add(taskId);
      return false;
    };

    for (const taskId of taskNames.keys()) {
      if (visit(taskId)) {
        errors.push({
          code: 'DEPENDENCY_CYCLE',
          path: taskNames.get(taskId) ?? taskId,
          message: 'Task dependency cycle detected.',
        });
        break;
      }
    }
  }

  private async validateCompanyReferences(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const companyId = version.onboardingTemplate.companyId;

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (
            task.referenceType === ReferenceType.DOCUMENT_TYPE &&
            task.referenceId
          ) {
            const documentType =
              await this.prisma.employeeDocumentType.findFirst({
                where: {
                  id: task.referenceId,
                  companyId,
                },
                select: { id: true },
              });

            if (!documentType) {
              errors.push({
                code: 'INVALID_DOCUMENT_REFERENCE',
                path: task.taskName,
                message:
                  'Referenced document type does not belong to the template company.',
              });
            }
          }
        }
      }
    }
  }

  private validateWorkTypes(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (!SUPPORTED_WORK_TYPES.has(task.workType)) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.TEMPLATE_WORK_TYPE_UNSUPPORTED,
              path: task.taskName,
              message: `Work type ${task.workType} is not supported for publishing.`,
            });
          }
        }
      }
    }
  }

  private async validateAssetTasks(
    version: VersionPayload,
    errors: ValidationMessageContract[],
  ) {
    const companyId = version.onboardingTemplate.companyId;

    for (const department of version.departments) {
      for (const group of department.taskGroups) {
        for (const task of group.tasks) {
          if (task.workType !== WorkType.ASSET) {
            continue;
          }

          if (
            task.ownerType !== 'DEPARTMENT' ||
            task.referenceType !== ReferenceType.ASSET_TYPE ||
            !task.referenceId
          ) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
              path: task.taskName,
              message:
                'Asset tasks require Department ownership and an Asset Type reference.',
            });
            continue;
          }

          const assetType = await this.prisma.assetType.findFirst({
            where: {
              id: task.referenceId,
              companyId,
              isActive: true,
              archivedAt: null,
            },
            select: {
              id: true,
              trackingMode: true,
            },
          });

          if (!assetType) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
              path: task.taskName,
              message:
                'Asset Type is missing, inactive, or outside this company.',
            });
            continue;
          }

          if (assetType.trackingMode === AssetTrackingMode.LOCATION) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_LOCATION_NOT_SUPPORTED,
              path: task.taskName,
              message:
                'LOCATION Asset Types cannot be used on onboarding tasks.',
            });
            continue;
          }

          if (
            assetType.trackingMode !== AssetTrackingMode.INDIVIDUAL &&
            assetType.trackingMode !== AssetTrackingMode.POOL
          ) {
            errors.push({
              code: ONBOARDING_TEMPLATE_ERROR_CODES.ASSET_TASK_INVALID_TYPE,
              path: task.taskName,
              message: 'Asset Type must use INDIVIDUAL or POOL tracking.',
            });
          }
        }
      }
    }
  }
}
