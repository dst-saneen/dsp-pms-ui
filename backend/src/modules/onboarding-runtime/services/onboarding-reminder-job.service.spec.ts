import { ConfigService } from '@nestjs/config';

import type { Environment } from '../../../config';

import { OnboardingReminderJobService } from './onboarding-reminder-job.service';

type ReminderTask = {
  id: string;
  companyId: string | null;
  branchId: string | null;
  employeeId: string | null;
  onboardingId: string;
  assignedToUserId: string | null;
  dueDate: Date | null;
  statusV2: string | null;
};

type ReminderCursorCondition = {
  OR: Array<
    | { dueDate: { gt: Date } }
    | { AND: [{ dueDate: Date }, { id: { gt: string } }] }
  >;
};

type ReminderFindManyArgs = {
  where: { AND: [unknown, ReminderCursorCondition] };
  orderBy: Array<{ dueDate?: 'asc'; id?: 'asc' }>;
  take: number;
};

describe('OnboardingReminderJobService', () => {
  const featureGate = {
    hasAnyEnabledCompany: jest.fn<Promise<boolean>, []>(() =>
      Promise.resolve(true),
    ),
    isEnabledForContext: jest.fn<boolean, [string, string | undefined]>(
      () => true,
    ),
  };
  const notification = {
    buildTaskActionDedupeKey: jest.fn<string, [string, string, string, string]>(
      (
        eventCode: string,
        taskId: string,
        businessDate: string,
        recipientUserId: string,
      ) =>
        `onboarding:${eventCode}:${taskId}:${businessDate}:user:${recipientUserId}`,
    ),
    enqueueInTransaction: jest
      .fn<Promise<{ created: boolean }>, unknown[]>()
      .mockResolvedValue({ created: true }),
  };
  const configService = {
    get: jest.fn<boolean, [string, unknown?]>(() => true),
  };
  const prisma = {
    employeeOnboardingTask: {
      findMany: jest.fn<Promise<ReminderTask[]>, [ReminderFindManyArgs]>(),
    },
  };

  const service = new OnboardingReminderJobService(
    prisma as never,
    featureGate as never,
    notification as never,
    configService as unknown as ConfigService<Environment, true>,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    featureGate.hasAnyEnabledCompany.mockResolvedValue(true);
    featureGate.isEnabledForContext.mockReturnValue(true);
    configService.get.mockReturnValue(true);
    notification.enqueueInTransaction.mockResolvedValue({ created: true });
  });

  it('pages with keyset cursor across batches of 200', async () => {
    const asOf = new Date('2026-09-17T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(asOf);

    const dueDate = new Date('2026-09-16T00:00:00.000Z');
    const batch1: ReminderTask[] = Array.from({ length: 200 }, (_, index) => ({
      id: `task-${String(index).padStart(3, '0')}`,
      companyId: 'co-1',
      branchId: 'br-1',
      employeeId: 'emp-1',
      onboardingId: 'onb-1',
      assignedToUserId: 'user-1',
      dueDate,
      statusV2: 'PENDING',
    }));
    const batch2: ReminderTask[] = [
      {
        id: 'task-200',
        companyId: 'co-1',
        branchId: 'br-1',
        employeeId: 'emp-1',
        onboardingId: 'onb-1',
        assignedToUserId: 'user-1',
        dueDate,
        statusV2: 'PENDING',
      },
    ];

    prisma.employeeOnboardingTask.findMany
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2);

    const result = await service.runDueReminders();

    expect(prisma.employeeOnboardingTask.findMany).toHaveBeenCalledTimes(2);
    const secondCall = prisma.employeeOnboardingTask.findMany.mock.calls[1][0];
    expect(secondCall.orderBy).toEqual([{ dueDate: 'asc' }, { id: 'asc' }]);
    expect(secondCall.take).toBe(200);
    expect(secondCall.where.AND[1].OR).toEqual(
      expect.arrayContaining([
        { dueDate: { gt: dueDate } },
        {
          AND: [{ dueDate }, { id: { gt: 'task-199' } }],
        },
      ]),
    );

    expect(result.scanned).toBe(201);
    expect(result.queued).toBe(201);
    expect(notification.enqueueInTransaction).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        eventCode: 'ONBOARDING_TASK_OVERDUE',
        recipientUserId: 'user-1',
        onboardingTaskId: 'task-000',
      }),
      expect.stringContaining('ONBOARDING_TASK_OVERDUE'),
    );

    jest.useRealTimers();
  });

  it('counts only newly created outbox rows on dedupe', async () => {
    prisma.employeeOnboardingTask.findMany.mockResolvedValueOnce([
      {
        id: 'task-a',
        companyId: 'co-1',
        branchId: 'br-1',
        employeeId: 'emp-1',
        onboardingId: 'onb-1',
        assignedToUserId: 'user-1',
        dueDate: new Date('2026-09-16T00:00:00.000Z'),
        statusV2: 'PENDING',
      },
      {
        id: 'task-b',
        companyId: 'co-1',
        branchId: 'br-1',
        employeeId: 'emp-1',
        onboardingId: 'onb-1',
        assignedToUserId: 'user-1',
        dueDate: new Date('2026-09-16T00:00:00.000Z'),
        statusV2: 'PENDING',
      },
    ]);
    notification.enqueueInTransaction
      .mockResolvedValueOnce({ created: true })
      .mockResolvedValueOnce({ created: false });

    const result = await service.runDueReminders();
    expect(result.scanned).toBe(2);
    expect(result.queued).toBe(1);
  });

  it('skips when reminders are disabled', async () => {
    configService.get.mockReturnValue(false);
    const result = await service.runDueReminders();
    expect(result).toEqual({ scanned: 0, queued: 0 });
    expect(prisma.employeeOnboardingTask.findMany).not.toHaveBeenCalled();
  });

  it('skips unassigned tasks without enqueue', async () => {
    prisma.employeeOnboardingTask.findMany.mockResolvedValueOnce([
      {
        id: 'task-u',
        companyId: 'co-1',
        branchId: 'br-1',
        employeeId: 'emp-1',
        onboardingId: 'onb-1',
        assignedToUserId: null,
        dueDate: new Date('2026-09-16T00:00:00.000Z'),
        statusV2: 'PENDING',
      },
    ]);

    const result = await service.runDueReminders();
    expect(result.scanned).toBe(1);
    expect(result.queued).toBe(0);
    expect(notification.enqueueInTransaction).not.toHaveBeenCalled();
  });
});
