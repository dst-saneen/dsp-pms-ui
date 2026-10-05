import { TaskStatus } from '@prisma/client';

import {
  DomainConflictException,
  requestContextStorage,
} from '../../src/common';
import { EmployeeOnboardingTaskService } from '../../src/modules/employee-onboarding-task/employee-onboarding-task.service';
import { withInteractiveTransaction } from './test-mocks';

describe('EmployeeOnboardingTaskService state machine', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const scopeService = {
    onboardingTaskWhere: jest.fn().mockReturnValue({}),
  };

  function createService(prisma: Record<string, unknown>) {
    return new EmployeeOnboardingTaskService(
      withInteractiveTransaction(prisma) as never,
      auditService as never,
      scopeService as never,
      {
        assertEnabledForContext: jest.fn().mockResolvedValue(undefined),
      } as never,
    );
  }

  function withActor(fn: () => Promise<void>) {
    return requestContextStorage.run(
      {
        requestId: 'test',
        userId: 'user-1',
        activeCompanyId: 'company-a',
        scopeLevel: 'COMPANY',
      },
      fn,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects skipping a mandatory task', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          onboardingId: 'ob-1',
          status: TaskStatus.PENDING,
          isMandatory: true,
          allowSkip: true,
          dependsOnTaskId: null,
          remarks: null,
          onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
        }),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      await expect(
        service.skipTask('task-1', { reason: 'Not needed' }),
      ).rejects.toBeInstanceOf(DomainConflictException);

      try {
        await service.skipTask('task-1', { reason: 'Not needed' });
      } catch (error) {
        expect((error as DomainConflictException).code).toBe(
          'MANDATORY_TASK_NOT_SKIPPABLE',
        );
      }
    });
  });

  it('rejects skip when allowSkip is false', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          onboardingId: 'ob-1',
          status: TaskStatus.PENDING,
          isMandatory: false,
          allowSkip: false,
          dependsOnTaskId: null,
          remarks: null,
          onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
        }),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      await expect(
        service.skipTask('task-1', { reason: 'Skip please' }),
      ).rejects.toMatchObject({ code: 'TASK_SKIP_NOT_ALLOWED' });
    });
  });

  it('blocks completion when dependency is incomplete', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-2',
          taskName: 'Follow-up',
          onboardingId: 'ob-1',
          status: TaskStatus.PENDING,
          isMandatory: true,
          allowSkip: false,
          dependsOnTaskId: 'task-1',
          dependsOnTask: { id: 'task-1', status: TaskStatus.PENDING },
          remarks: null,
          onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
        }),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      await expect(
        service.completeTask('task-2', { remarks: 'done' }),
      ).rejects.toMatchObject({ code: 'DEPENDENCY_NOT_COMPLETED' });
    });
  });

  it('returns existing task when complete is idempotent', async () => {
    const completed = {
      id: 'task-1',
      onboardingId: 'ob-1',
      status: TaskStatus.COMPLETED,
      isMandatory: true,
      allowSkip: false,
      dependsOnTaskId: null,
      remarks: null,
      onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
    };

    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue(completed),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      const result = await service.completeTask('task-1', {});
      expect(result).toEqual(completed);
    });
  });

  it('rejects reopen when allowReopen is false', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          onboardingId: 'ob-1',
          status: TaskStatus.COMPLETED,
          isMandatory: true,
          allowReopen: false,
          allowSkip: false,
          dependsOnTaskId: null,
          remarks: null,
          attemptNo: 1,
          onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
        }),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      await expect(
        service.reopenTask('task-1', { reason: 'Need redo' }),
      ).rejects.toMatchObject({ code: 'TASK_REOPEN_NOT_ALLOWED' });
    });
  });

  it('throws TASK_STATE_CHANGED when concurrent update loses race', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'task-1',
          taskName: 'Optional task',
          onboardingId: 'ob-1',
          status: TaskStatus.PENDING,
          isMandatory: false,
          allowSkip: true,
          dependsOnTaskId: null,
          dependsOnTask: null,
          remarks: null,
          onboarding: { id: 'ob-1', status: TaskStatus.IN_PROGRESS },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn(),
      },
    };

    const service = createService(prisma);

    await withActor(async () => {
      await expect(
        service.skipTask('task-1', { reason: 'Not applicable' }),
      ).rejects.toMatchObject({ code: 'TASK_STATE_CHANGED' });
    });
  });
});
