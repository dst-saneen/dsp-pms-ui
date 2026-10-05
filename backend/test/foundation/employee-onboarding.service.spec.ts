import {
  DomainConflictException,
  DomainNotFoundException,
} from '../../src/common';
import { EmployeeOnboardingService } from '../../src/modules/employee-onboarding/employee-onboarding.service';

describe('EmployeeOnboardingService start transaction', () => {
  const auditService = {
    log: jest.fn().mockResolvedValue(undefined),
  };

  const repository = {
    search: jest.fn(),
    getSummary: jest.fn(),
    findByEmployee: jest.fn(),
  };

  const scopeService = {
    employeeWhere: jest.fn().mockReturnValue({}),
    onboardingWhere: jest.fn().mockReturnValue({}),
    onboardingTemplateWhere: jest.fn().mockReturnValue({}),
  };

  const featureGate = {
    assertEnabledForContext: jest.fn().mockResolvedValue(undefined),
  };

  function createService(prisma: Record<string, unknown>) {
    return new EmployeeOnboardingService(
      repository as never,
      prisma as never,
      auditService as never,
      scopeService as never,
      featureGate as never,
      { recordOnboardingStarted: jest.fn() } as never,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects when employee is out of scope', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        templateId: 'tpl-1',
        startDate: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(DomainNotFoundException);
  });

  it('rejects when template has no published version', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-1',
          companyId: 'company-a',
          isActive: true,
        }),
      },
      onboardingTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tpl-1',
          companyId: 'company-a',
          isActive: true,
        }),
      },
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        templateId: 'tpl-1',
        startDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'ONBOARDING_TEMPLATE_NOT_PUBLISHED' });
  });

  it('rejects when active onboarding already exists', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-1',
          companyId: 'company-a',
          isActive: true,
        }),
      },
      onboardingTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tpl-1',
          companyId: 'company-a',
          isActive: true,
        }),
      },
      onboardingTemplateVersion: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ver-1',
          status: 'PUBLISHED',
          isCurrent: true,
        }),
      },
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ob-existing',
          status: 'IN_PROGRESS',
        }),
      },
    };

    const service = createService(prisma);

    await expect(
      service.create({
        employeeId: 'emp-1',
        templateId: 'tpl-1',
        startDate: '2026-07-01',
      }),
    ).rejects.toBeInstanceOf(DomainConflictException);

    await expect(
      service.create({
        employeeId: 'emp-1',
        templateId: 'tpl-1',
        startDate: '2026-07-01',
      }),
    ).rejects.toMatchObject({ code: 'ACTIVE_ONBOARDING_EXISTS' });
  });

  it('blocks completion when mandatory tasks are incomplete', async () => {
    const prisma = {
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ob-1',
          status: 'IN_PROGRESS',
          tasks: [
            {
              id: 't1',
              isMandatory: true,
              status: 'PENDING',
            },
          ],
        }),
      },
    };

    const service = createService(prisma);

    await expect(service.completeOnboarding('ob-1')).rejects.toMatchObject({
      code: 'MANDATORY_TASKS_INCOMPLETE',
    });
  });

  it('cancels unfinished tasks and preserves completed history', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const onboardingUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
    const onboardingFind = jest.fn().mockResolvedValue({
      id: 'ob-1',
      status: 'CANCELLED',
      tasks: [],
    });

    const prisma = {
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ob-1',
          status: 'IN_PROGRESS',
          tasks: [
            { id: 't1', status: 'COMPLETED', isMandatory: true },
            { id: 't2', status: 'PENDING', isMandatory: false },
          ],
        }),
        updateMany: onboardingUpdateMany,
        findUniqueOrThrow: onboardingFind,
      },
      $transaction: jest.fn(
        async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            employeeOnboardingTask: { updateMany },
            employeeOnboarding: {
              updateMany: onboardingUpdateMany,
              findUniqueOrThrow: onboardingFind,
            },
          }),
      ),
    };

    const service = createService(prisma);
    const result = await service.remove('ob-1');

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          onboardingId: 'ob-1',
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
        }) as unknown,
        data: { status: 'CANCELLED' },
      }),
    );
    expect(result.status).toBe('CANCELLED');
  });

  it('rejects cancel when onboarding is already completed', async () => {
    const prisma = {
      employeeOnboarding: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'ob-1',
          status: 'COMPLETED',
          tasks: [],
        }),
      },
    };

    const service = createService(prisma);

    await expect(service.remove('ob-1')).rejects.toMatchObject({
      code: 'ONBOARDING_ALREADY_COMPLETED',
    });
  });
});
