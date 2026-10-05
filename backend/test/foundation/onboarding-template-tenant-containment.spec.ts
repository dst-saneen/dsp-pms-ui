import { DomainNotFoundException } from '../../src/common';
import { OnboardingDepartmentTemplateService } from '../../src/modules/onboarding-department-template/services/onboarding-department-template.service';
import { OnboardingTaskGroupService } from '../../src/modules/onboarding-task-group/services/onboarding-task-group.service';
import { OnboardingTemplateTaskService } from '../../src/modules/onboarding-template-task/services/onboarding-template-task.service';

describe('Onboarding template nested tenant containment', () => {
  const notFound = new DomainNotFoundException(
    'ONBOARDING_DEPARTMENT_TEMPLATE_NOT_FOUND',
    'Department template not found.',
  );

  it('returns 404 for a foreign-company department slice', async () => {
    const templateScope = {
      requireDepartmentTemplate: jest.fn().mockRejectedValue(notFound),
    };
    const service = new OnboardingDepartmentTemplateService(
      {} as never,
      {} as never,
      templateScope as never,
    );

    await expect(service.findOne('foreign-id')).rejects.toBeInstanceOf(
      DomainNotFoundException,
    );
  });

  it('returns 404 for a foreign task group', async () => {
    const templateScope = {
      requireTaskGroup: jest
        .fn()
        .mockRejectedValue(
          new DomainNotFoundException(
            'ONBOARDING_TASK_GROUP_NOT_FOUND',
            'Task group not found.',
          ),
        ),
    };
    const service = new OnboardingTaskGroupService(
      {} as never,
      {} as never,
      templateScope as never,
    );

    await expect(service.findOne('foreign-group')).rejects.toBeInstanceOf(
      DomainNotFoundException,
    );
  });

  it('returns 404 for a foreign template task', async () => {
    const templateScope = {
      requireTask: jest
        .fn()
        .mockRejectedValue(
          new DomainNotFoundException(
            'ONBOARDING_TEMPLATE_TASK_NOT_FOUND',
            'Task not found.',
          ),
        ),
    };
    const service = new OnboardingTemplateTaskService(
      {} as never,
      templateScope as never,
    );

    await expect(service.findOne('foreign-task')).rejects.toBeInstanceOf(
      DomainNotFoundException,
    );
  });

  it('rejects cross-branch department attachment', async () => {
    const templateScope = {
      requireMutableVersion: jest.fn().mockResolvedValue({
        id: 'ver-1',
        companyId: 'co-1',
        onboardingTemplate: { companyId: 'co-1' },
      }),
      resolveVersionCompanyId: jest.fn().mockReturnValue('co-1'),
      requireDepartmentInCompanyBranch: jest.fn().mockResolvedValue({
        id: 'dept-2',
        companyId: 'co-1',
        branchId: 'br-2',
      }),
      departmentTemplateWhere: jest.fn().mockReturnValue({}),
    };
    const prisma = {
      onboardingDepartmentTemplate: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ department: { branchId: 'br-1' } }]),
      },
    };
    const validation = {
      ensureUniqueDepartment: jest.fn(),
      ensureUniqueDisplayOrder: jest.fn(),
    };
    const service = new OnboardingDepartmentTemplateService(
      prisma as never,
      validation as never,
      templateScope as never,
    );

    await expect(
      service.create({
        onboardingTemplateVersionId: 'ver-1',
        departmentId: 'dept-2',
        displayOrder: 2,
        isRequired: true,
      }),
    ).rejects.toMatchObject({
      code: 'TEMPLATE_BRANCH_MISMATCH',
    });
  });

  it('resolves the first Department slice through the actor Branch scope', async () => {
    const outOfBranch = new DomainNotFoundException(
      'DEPARTMENT_NOT_FOUND',
      'Department not found.',
    );
    const templateScope = {
      requireMutableVersion: jest.fn().mockResolvedValue({
        id: 'ver-1',
        companyId: 'co-1',
        onboardingTemplate: { companyId: 'co-1' },
      }),
      resolveVersionCompanyId: jest.fn().mockReturnValue('co-1'),
      requireDepartmentInCompany: jest.fn().mockRejectedValue(outOfBranch),
      departmentTemplateWhere: jest.fn().mockReturnValue({}),
    };
    const prisma = {
      onboardingDepartmentTemplate: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
    };
    const service = new OnboardingDepartmentTemplateService(
      prisma as never,
      {
        ensureUniqueDepartment: jest.fn(),
        ensureUniqueDisplayOrder: jest.fn(),
      } as never,
      templateScope as never,
    );

    await expect(
      service.create({
        onboardingTemplateVersionId: 'ver-1',
        departmentId: 'dept-outside-branch',
        displayOrder: 1,
        isRequired: true,
      }),
    ).rejects.toBe(outOfBranch);

    expect(templateScope.requireDepartmentInCompany).toHaveBeenCalledWith({
      companyId: 'co-1',
      departmentId: 'dept-outside-branch',
    });
    expect(prisma.onboardingDepartmentTemplate.create).not.toHaveBeenCalled();
  });
});
