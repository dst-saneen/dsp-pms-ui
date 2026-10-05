import { GUARDS_METADATA } from '@nestjs/common/constants';

import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../src/common';
import { resolveRoutePermissions } from '../../src/modules/auth/route-policy';
import { OnboardingTemplateScopeService } from '../../src/modules/onboarding-template/services/onboarding-template-scope.service';
import { OnboardingEnabledGuard } from '../../src/modules/onboarding-runtime/guards/onboarding-enabled.guard';
import { TaskContributionController } from '../../src/modules/task-contribution/controllers/task-contribution.controller';
import { TaskContributionService } from '../../src/modules/task-contribution/services/task-contribution.service';
import { TaskContributionValidationService } from '../../src/modules/task-contribution/services/task-contribution-validation.service';

const taskContext = {
  id: 'task-a',
  taskGroup: {
    onboardingDepartmentTemplateId: 'department-template-a',
    departmentTemplate: {
      onboardingTemplateVersionId: 'version-a',
    },
  },
};

const contributionContext = {
  id: 'contribution-a',
  onboardingDepartmentTemplateId: 'department-template-a',
  departmentTemplate: {
    onboardingTemplateVersionId: 'version-a',
  },
};

const persistedLink = {
  id: 'task-contribution-a',
  taskId: taskContext.id,
  contributionId: contributionContext.id,
  displayOrder: 0,
  isRequired: true,
  task: {
    taskGroup: {
      onboardingDepartmentTemplateId: 'department-template-a',
    },
  },
  contribution: {
    id: contributionContext.id,
    onboardingDepartmentTemplateId: 'department-template-a',
  },
};

function buildSubject(options?: {
  findFirst?: unknown;
  task?: unknown;
  contribution?: unknown;
  mutableVersion?: unknown;
}) {
  const transactionClient = {
    taskContribution: {
      create: jest.fn().mockResolvedValue({
        ...persistedLink,
        contribution: { id: contributionContext.id },
      }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    taskContribution: {
      findFirst: jest.fn().mockResolvedValue(options?.findFirst),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(
      (callback: (client: typeof transactionClient) => Promise<unknown>) =>
        callback(transactionClient),
    ),
  };
  const templateScope = {
    taskWhere: jest.fn().mockReturnValue({ taskScope: 'company-a' }),
    contributionWhere: jest
      .fn()
      .mockReturnValue({ contributionScope: 'company-a' }),
    assertEnabledForCurrentContext: jest.fn().mockResolvedValue(undefined),
    requireMutableVersion: jest
      .fn()
      .mockResolvedValue(options?.mutableVersion ?? { id: 'version-a' }),
    lockMutableVersion: jest.fn().mockResolvedValue(undefined),
    assertMutationApplied: jest.fn(),
  };
  const validation = {
    ensureTaskExists: jest.fn().mockResolvedValue(options?.task ?? taskContext),
    ensureContributionExists: jest
      .fn()
      .mockResolvedValue(options?.contribution ?? contributionContext),
    ensureUniqueTaskContribution: jest.fn().mockResolvedValue(undefined),
  };

  return {
    prisma,
    transactionClient,
    templateScope,
    validation,
    service: new TaskContributionService(
      prisma as never,
      validation as unknown as TaskContributionValidationService,
      templateScope as unknown as OnboardingTemplateScopeService,
    ),
  };
}

describe('task-contribution entitlement and tenant containment', () => {
  it('uses the onboarding guard and least-privilege onboarding route policy', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TaskContributionController,
    ) as unknown[];

    expect(guards).toContain(OnboardingEnabledGuard);
    expect(resolveRoutePermissions('task-contribution', 'GET')).toEqual([
      'hr.onboarding.read',
    ]);
    expect(
      resolveRoutePermissions('task-contribution/task/task-a', 'GET'),
    ).toEqual(['hr.onboarding.read']);
    expect(resolveRoutePermissions('task-contribution', 'POST')).toEqual([
      'hr.onboarding.manage',
    ]);
  });

  it('scopes collection reads through both the task and contribution parents', async () => {
    const { service, prisma, templateScope } = buildSubject();

    await expect(service.findAll()).resolves.toEqual([]);

    expect(templateScope.assertEnabledForCurrentContext).toHaveBeenCalledTimes(
      1,
    );
    expect(prisma.taskContribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          task: { taskScope: 'company-a' },
          contribution: { contributionScope: 'company-a' },
        },
      }),
    );
  });

  it.each([
    ['read', (service: TaskContributionService) => service.findOne('foreign')],
    [
      'update',
      (service: TaskContributionService) =>
        service.update('foreign', { displayOrder: 1 }),
    ],
    ['delete', (service: TaskContributionService) => service.remove('foreign')],
  ])(
    'returns not found and never writes for a cross-company direct ID on %s',
    async (_operation, invoke) => {
      const { service, prisma, transactionClient, validation } = buildSubject({
        findFirst: null,
      });

      await expect(invoke(service)).rejects.toBeInstanceOf(
        DomainNotFoundException,
      );

      expect(validation.ensureTaskExists).not.toHaveBeenCalled();
      expect(validation.ensureContributionExists).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(
        transactionClient.taskContribution.updateMany,
      ).not.toHaveBeenCalled();
      expect(
        transactionClient.taskContribution.deleteMany,
      ).not.toHaveBeenCalled();
    },
  );

  it('does not query or write when a task or contribution input is outside the selected Company', async () => {
    const foreign = new DomainNotFoundException(
      'ONBOARDING_TEMPLATE_TASK_NOT_FOUND',
      'Task not found.',
    );
    const first = buildSubject();
    first.validation.ensureTaskExists.mockRejectedValue(foreign);

    await expect(first.service.findByTask('foreign-task')).rejects.toBe(
      foreign,
    );
    expect(first.prisma.taskContribution.findMany).not.toHaveBeenCalled();

    const second = buildSubject();
    second.validation.ensureContributionExists.mockRejectedValue(foreign);

    await expect(
      second.service.create({
        taskId: taskContext.id,
        contributionId: 'foreign-contribution',
      }),
    ).rejects.toBe(foreign);

    expect(
      second.validation.ensureUniqueTaskContribution,
    ).not.toHaveBeenCalled();
    expect(second.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a cross-template or cross-department link before creating it', async () => {
    const { service, prisma, templateScope, validation } = buildSubject({
      contribution: {
        ...contributionContext,
        onboardingDepartmentTemplateId: 'department-template-b',
        departmentTemplate: {
          onboardingTemplateVersionId: 'version-b',
        },
      },
    });

    await expect(
      service.create({
        taskId: taskContext.id,
        contributionId: contributionContext.id,
      }),
    ).rejects.toBeInstanceOf(DomainConflictException);

    expect(validation.ensureUniqueTaskContribution).not.toHaveBeenCalled();
    expect(templateScope.requireMutableVersion).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('locks the matching draft version before creating an in-scope link', async () => {
    const { service, transactionClient, templateScope } = buildSubject();

    await service.create({
      taskId: taskContext.id,
      contributionId: contributionContext.id,
      displayOrder: 2,
      isRequired: false,
    });

    expect(templateScope.requireMutableVersion).toHaveBeenCalledWith(
      'version-a',
    );
    expect(templateScope.lockMutableVersion).toHaveBeenCalledWith(
      transactionClient,
      'version-a',
    );
    expect(transactionClient.taskContribution.create).toHaveBeenCalledWith({
      data: {
        taskId: taskContext.id,
        contributionId: contributionContext.id,
        displayOrder: 2,
        isRequired: false,
      },
      include: {
        contribution: true,
      },
    });
  });

  it('refuses an update before mutation when the link belongs to a non-draft version', async () => {
    const immutable = new DomainConflictException(
      'TEMPLATE_VERSION_STATE_CHANGED',
      'Published versions are immutable.',
    );
    const { service, prisma, transactionClient, templateScope } = buildSubject({
      findFirst: persistedLink,
    });
    templateScope.requireMutableVersion.mockRejectedValue(immutable);

    await expect(
      service.update(persistedLink.id, { displayOrder: 3 }),
    ).rejects.toBe(immutable);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(
      transactionClient.taskContribution.updateMany,
    ).not.toHaveBeenCalled();
  });
});
