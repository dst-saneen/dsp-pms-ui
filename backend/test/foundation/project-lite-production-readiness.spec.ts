/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Jest asymmetric matcher types are intentionally dynamic in this contract test. */
import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEventStatus,
} from '@prisma/client';

import { DeliveryProjectRecipientHandler } from '../../src/modules/delivery/resolution/delivery-project-recipient.handler';
import { toProjectCommandReceiptSafeSnapshot } from '../../src/modules/projects/policies/project-command-receipt-replay';
import { weekStartOf } from '../../src/modules/projects/policies/work-log-week';
import { ProjectTaskReminderJobService } from '../../src/modules/projects/services/project-task-reminder-job.service';
import { parseProjectsWeekStartSetting } from '../../src/modules/projects/services/project-time-policy.service';
import { ProjectTimesheetCommandService } from '../../src/modules/projects/services/project-timesheet-command.service';

describe('Project Lite production receipt and calendar policies', () => {
  it('stores only the entity id, state and version in a receipt snapshot', () => {
    expect(
      toProjectCommandReceiptSafeSnapshot({
        entityId: 'task-1',
        snapshot: {
          id: 'task-1',
          status: 'IN_PROGRESS',
          version: 4,
          remarks: 'private note',
          fileObjectId: 'file-1',
          returnReason: 'private reason',
        },
      }),
    ).toEqual({
      entityId: 'task-1',
      state: 'IN_PROGRESS',
      version: 4,
    });
  });

  it('uses a typed Company week-start setting instead of fixed Monday weeks', () => {
    expect(parseProjectsWeekStartSetting('SUNDAY')).toBe(0);
    expect(parseProjectsWeekStartSetting(undefined)).toBe(1);
    expect(
      weekStartOf(new Date('2026-08-19T00:00:00.000Z'), 0)
        .toISOString()
        .slice(0, 10),
    ).toBe('2026-08-16');
    expect(() => parseProjectsWeekStartSetting('weekday-8')).toThrow();
  });
});

describe('Project Lite delivery recipient revalidation', () => {
  it('requires an active exact Company/Branch Employee/User and active task participation', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            email: 'member@example.test',
            normalizedEmail: 'member@example.test',
            displayName: 'Member',
            employee: { id: 'employee-1', companyId: 'co-1', branchId: 'br-1' },
          },
        ]),
      },
    };
    const handler = new DeliveryProjectRecipientHandler(prisma as never);

    const result = await handler.resolve(
      {
        id: 'evt-1',
        companyGroupId: 'cg-1',
        companyId: 'co-1',
        branchId: 'br-1',
        aggregateType: 'PROJECT_TASK',
        aggregateId: 'task-1',
        eventType: 'projects.task.due_soon',
        dedupeKey: 'projects.task.due_soon:task-1:2026-09-01:user-1',
        status: OutboxEventStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        processedAt: null,
        lastErrorCode: null,
        payload: {
          taskId: 'task-1',
          recipientUserIds: ['user-1', 'stale-user'],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        handlerKind: 'PROJECT',
        subject: 'A project task is due soon',
        assigneeChannels: [DeliveryChannel.IN_APP],
      },
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          employee: expect.objectContaining({
            is: expect.objectContaining({
              companyId: 'co-1',
              branchId: 'br-1',
              taskParticipants: expect.objectContaining({
                some: expect.objectContaining({ taskId: 'task-1' }),
              }),
            }),
          }),
        }),
      }),
    );
    expect(result.recipients).toEqual([
      expect.objectContaining({
        kind: DeliveryRecipientKind.USER,
        recipientUserId: 'user-1',
        recipientEmployeeId: 'employee-1',
      }),
    ]);
    expect(result.exceptions.map((item) => item.reasonCode)).toContain(
      'PROJECT_RECIPIENT_UNAVAILABLE',
    );
  });
});

describe('Project Lite timesheet effective-date eligibility', () => {
  it('requires both a participant and Project team member effective on the work date', async () => {
    const tx = {
      taskParticipant: {
        findFirst: jest.fn().mockResolvedValue({ projectId: 'project-1' }),
      },
      projectTeamMember: {
        findFirst: jest.fn().mockResolvedValue({ id: 'team-1' }),
      },
    };
    const timePolicy = {
      businessDayWindow: jest.fn().mockResolvedValue({
        start: new Date('2026-09-01T00:00:00.000Z'),
        endExclusive: new Date('2026-09-02T00:00:00.000Z'),
      }),
    };
    const service = new ProjectTimesheetCommandService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      timePolicy as never,
    );

    await (
      service as unknown as {
        assertActiveTaskAssignment: (...args: unknown[]) => Promise<void>;
      }
    ).assertActiveTaskAssignment(
      tx,
      'co-1',
      'br-1',
      'employee-1',
      'task-1',
      new Date('2026-09-01T00:00:00.000Z'),
    );

    expect(tx.taskParticipant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ OR: expect.any(Array) }),
          ]),
        }),
      }),
    );
    expect(tx.projectTeamMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ projectId: 'project-1' }),
      }),
    );
  });
});

describe('Project Lite task reminders', () => {
  it('queues one recipient-specific due-soon event with a Branch business date', async () => {
    const prisma = {
      projectTask: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            companyId: 'co-1',
            projectId: 'project-1',
            dueDate: new Date('2026-09-01T00:00:00.000Z'),
            statusV2: 'IN_PROGRESS',
            project: { branchId: 'br-1' },
            participants: [
              {
                employee: {
                  id: 'employee-1',
                  companyId: 'co-1',
                  branchId: 'br-1',
                  isActive: true,
                  branch: {
                    id: 'br-1',
                    companyId: 'co-1',
                    isActive: true,
                    timezone: 'Asia/Kolkata',
                  },
                  user: { id: 'user-1', status: 'ACTIVE' },
                },
              },
            ],
          },
        ]),
      },
    };
    const notification = {
      enqueue: jest.fn().mockResolvedValue({ id: 'evt-1', created: true }),
    };
    const service = new ProjectTaskReminderJobService(
      prisma as never,
      {
        hasAnyEnabledCompany: jest.fn().mockResolvedValue(true),
        isEnabledForContext: jest.fn().mockReturnValue(true),
      } as never,
      notification as never,
      {
        businessDateAt: jest
          .fn()
          .mockReturnValue(new Date('2026-09-01T00:00:00.000Z')),
      } as never,
      { get: jest.fn().mockReturnValue(true) } as never,
    );

    await expect(
      service.runDueReminders(new Date('2026-09-01T08:00:00.000Z')),
    ).resolves.toEqual({ scanned: 1, queued: 1 });
    expect(notification.enqueue).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        branchId: 'br-1',
        taskId: 'task-1',
        recipientUserIds: ['user-1'],
        dedupeKey: 'projects.task.due_soon:task-1:2026-09-01:user-1',
      }),
    );
  });
});
