import {
  DeliveryChannel,
  DeliveryRecipientKind,
  OutboxEventStatus,
  RoleScope,
  UserStatus,
} from '@prisma/client';

import { DeliveryHrRecipientService } from '../../src/modules/delivery/resolution/delivery-hr-recipient.service';
import { DeliveryOnboardingRecipientHandler } from '../../src/modules/delivery/resolution/delivery-onboarding-recipient.handler';
import { DeliveryOfficeFinanceRecipientHandler } from '../../src/modules/delivery/resolution/delivery-office-finance-recipient.handler';
import { DeliveryPayrollRecipientHandler } from '../../src/modules/delivery/resolution/delivery-payroll-recipient.handler';
import { DeliveryRecipientResolverService } from '../../src/modules/delivery/resolution/delivery-recipient-resolver.service';
import { DeliveryRecruitmentRecipientHandler } from '../../src/modules/delivery/resolution/delivery-recruitment-recipient.handler';
import { DeliveryWorkforceRecipientHandler } from '../../src/modules/delivery/resolution/delivery-workforce-recipient.handler';
import { DeliveryProjectRecipientHandler } from '../../src/modules/delivery/resolution/delivery-project-recipient.handler';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    companyGroupId: 'cg-1',
    companyId: 'co-1',
    branchId: 'br-1',
    aggregateType: 'recruitment',
    aggregateId: 'app-1',
    eventType: 'recruitment.application.received',
    dedupeKey: 'recruit:app-received:app-1',
    status: OutboxEventStatus.PENDING,
    attempts: 0,
    availableAt: new Date(),
    lockedAt: null,
    processedAt: null,
    lastErrorCode: null,
    payload: {
      candidateId: 'payload-cand',
      recipientUserIds: ['payload-hr'],
      panelUserIds: ['payload-panel'],
      panelEmails: ['payload-panel@evil.test'],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const candidate = {
  id: 'cand-1',
  email: 'Jane@Example.TEST',
  normalizedEmail: 'jane@example.test',
  firstName: 'Jane',
  lastName: 'Doe',
};

const opening = {
  id: 'open-1',
  companyGroupId: 'cg-1',
  companyId: 'co-1',
  branchId: 'br-1',
};

function buildResolver(prisma: Record<string, unknown>) {
  const hr = new DeliveryHrRecipientService(prisma as never);
  return new DeliveryRecipientResolverService(
    new DeliveryRecruitmentRecipientHandler(prisma as never, hr),
    new DeliveryOnboardingRecipientHandler(prisma as never, hr),
    new DeliveryProjectRecipientHandler(prisma as never),
    new DeliveryPayrollRecipientHandler(prisma as never),
    new DeliveryOfficeFinanceRecipientHandler(prisma as never, hr),
    new DeliveryWorkforceRecipientHandler(prisma as never, hr),
  );
}

describe('DeliveryRecipientResolverService (P0.6)', () => {
  it('reloads candidate through Application -> Opening and ignores payload IDs', async () => {
    const prisma = {
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          candidate,
          jobOpening: opening,
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'hr-db',
            displayName: 'HR User',
            email: 'hr@example.test',
            normalizedEmail: 'hr@example.test',
            employee: { id: 'hr-employee' },
          },
        ]),
      },
    };
    const result = await buildResolver(prisma).resolve(makeEvent());

    expect(prisma.jobApplication.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'app-1' } }),
    );
    expect(
      result.recipients.some((r) => r.recipientId === 'payload-cand'),
    ).toBe(false);
    expect(result.recipients.some((r) => r.recipientId === 'payload-hr')).toBe(
      false,
    );
    const candidateRecipient = result.recipients.find(
      (r) => r.kind === DeliveryRecipientKind.CANDIDATE,
    );
    expect(candidateRecipient?.toAddress).toBe('jane@example.test');
    expect(candidateRecipient?.channels).toEqual([DeliveryChannel.EMAIL]);
    expect(
      result.recipients.some(
        (r) => r.kind === DeliveryRecipientKind.HR && r.recipientId === 'hr-db',
      ),
    ).toBe(true);
  });

  it('records TENANT_MISMATCH and creates no recipients', async () => {
    const prisma = {
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          candidate,
          jobOpening: { ...opening, companyId: 'co-other' },
        }),
      },
      user: { findMany: jest.fn() },
    };
    const result = await buildResolver(prisma).resolve(makeEvent());

    expect(result.recipients).toEqual([]);
    expect(result.exceptions[0]?.reasonCode).toBe('TENANT_MISMATCH');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('records NO_SAFE_EMAIL when the candidate has no usable address', async () => {
    const prisma = {
      jobApplication: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'app-1',
          candidate: {
            ...candidate,
            email: 'not-an-email',
            normalizedEmail: 'also-bad',
          },
          jobOpening: opening,
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await buildResolver(prisma).resolve(makeEvent());

    expect(
      result.recipients.some((r) => r.kind === DeliveryRecipientKind.CANDIDATE),
    ).toBe(false);
    expect(result.exceptions.map((e) => e.reasonCode)).toEqual(
      expect.arrayContaining(['NO_SAFE_EMAIL']),
    );
  });

  it('resolves interview panel from persisted members, not payload emails', async () => {
    const prisma = {
      interviewSession: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sess-1',
          jobApplication: { candidate, jobOpening: opening },
          panelMembers: [
            {
              id: 'pm-1',
              assignmentStatus: 'ASSIGNED',
              employeeId: 'emp-1',
              employee: {
                id: 'emp-1',
                isActive: true,
                companyId: 'co-1',
                branchId: 'br-1',
                user: {
                  id: 'user-panel',
                  email: 'panel@example.test',
                  normalizedEmail: 'panel@example.test',
                  displayName: 'Panel',
                  status: UserStatus.ACTIVE,
                },
              },
            },
            {
              id: 'pm-other-co',
              assignmentStatus: 'ASSIGNED',
              employeeId: 'emp-x',
              employee: {
                id: 'emp-x',
                isActive: true,
                companyId: 'co-other',
                branchId: 'br-1',
                user: {
                  id: 'user-x',
                  email: 'x@example.test',
                  normalizedEmail: 'x@example.test',
                  displayName: 'Other Co',
                  status: UserStatus.ACTIVE,
                },
              },
            },
          ],
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateId: 'sess-1',
        eventType: 'recruitment.interview.scheduled',
      }),
    );

    const panel = result.recipients.filter(
      (r) => r.kind === DeliveryRecipientKind.PANEL_MEMBER,
    );
    expect(panel).toHaveLength(1);
    expect(panel[0]?.recipientId).toBe('pm-1');
    expect(panel[0]?.toAddress).toBe('panel@example.test');
    expect(panel[0]?.channels).toEqual(
      expect.arrayContaining([DeliveryChannel.EMAIL, DeliveryChannel.IN_APP]),
    );
    expect(panel.some((r) => r.toAddress === 'payload-panel@evil.test')).toBe(
      false,
    );
  });

  it('resolves signature submitted HR from DB scope, ignoring payload recipientUserIds', async () => {
    const prisma = {
      offerSignatureSubmission: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sub-1',
          jobOffer: {
            jobApplication: { candidate, jobOpening: opening },
          },
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'hr-db',
            displayName: 'HR User',
            email: 'hr@example.test',
            normalizedEmail: 'hr@example.test',
            employee: { id: 'hr-employee' },
          },
        ]),
      },
    };
    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateId: 'sub-1',
        eventType: 'recruitment.offer.signature.submitted',
      }),
    );

    expect(prisma.offerSignatureSubmission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sub-1' } }),
    );
    expect(result.recipients).toEqual([
      expect.objectContaining({
        kind: DeliveryRecipientKind.HR,
        recipientId: 'hr-db',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
        toAddress: 'hr@example.test',
      }),
    ]);
    expect(result.recipients.some((r) => r.recipientId === 'payload-hr')).toBe(
      false,
    );
  });

  it('uses onboarding task assignee, not payload recipientUserId', async () => {
    const prisma = {
      employeeOnboardingTask: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'task-1',
          companyId: 'co-1',
          branchId: 'br-1',
          executorDepartmentId: 'dept-1',
          assignedDepartmentId: 'dept-1',
          assignedToUser: {
            id: 'assignee-1',
            email: 'assignee@example.test',
            normalizedEmail: 'assignee@example.test',
            displayName: 'Assignee',
            status: UserStatus.ACTIVE,
          },
          onboarding: {
            companyId: 'co-1',
            branchId: 'br-1',
            departmentIdAtStart: 'dept-1',
          },
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'onboarding',
        aggregateId: 'task-1',
        eventType: 'ONBOARDING_TASK_ASSIGNED',
        payload: {
          recipientUserId: 'payload-user',
          onboardingTaskId: 'task-1',
        },
      }),
    );

    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientId: 'assignee-1',
        recipientUserId: 'assignee-1',
        toAddress: 'assignee@example.test',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
    expect(
      result.recipients.some((r) => r.recipientId === 'payload-user'),
    ).toBe(false);
  });

  it('resolves explicit workforce recipientUserIds only inside the event tenant', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            displayName: 'Active Employee',
            email: 'Employee@Example.test',
            normalizedEmail: 'employee@example.test',
            employee: { id: 'employee-1' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'LeaveRequest',
        aggregateId: 'leave-1',
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: { recipientUserIds: ['user-1', 'user-out-of-scope'] },
      }),
    );

    // Jest stores mock calls as any; cast the captured query for exact scope assertions.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const directQuery = prisma.user.findMany.mock.calls[0]?.[0] as {
      where: {
        id: { in: string[] };
        status: UserStatus;
        OR: unknown[];
      };
    };
    expect(directQuery.where.id).toEqual({
      in: ['user-1', 'user-out-of-scope'],
    });
    expect(directQuery.where.status).toBe(UserStatus.ACTIVE);
    expect(directQuery.where.OR).toContainEqual({
      employee: {
        is: {
          isActive: true,
          companyId: 'co-1',
          branchId: 'br-1',
        },
      },
    });
    expect(result.recipients).toEqual([
      expect.objectContaining({
        kind: DeliveryRecipientKind.USER,
        recipientId: 'user-1',
        recipientUserId: 'user-1',
        recipientEmployeeId: 'employee-1',
        toAddress: 'employee@example.test',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
    expect(result.exceptions).toEqual([
      expect.objectContaining({
        reasonCode: 'WORKFORCE_RECIPIENT_UNAVAILABLE',
      }),
    ]);
  });

  it('keeps in-app delivery when a workforce recipient has no safe email', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'user-1',
            displayName: 'No Email',
            email: 'invalid',
            normalizedEmail: null,
            employee: { id: 'employee-1' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        eventType: 'HR_REQUEST_COMPLETED',
        payload: { recipientUserId: 'user-1' },
      }),
    );

    expect(result.recipients[0]?.channels).toEqual([DeliveryChannel.IN_APP]);
    expect(result.exceptions).toEqual([
      expect.objectContaining({ reasonCode: 'NO_SAFE_EMAIL' }),
    ]);
  });

  it('resolves a workforce recipient through linked employeeId', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'employee-user',
            displayName: 'Linked Employee',
            email: 'linked@example.test',
            normalizedEmail: 'linked@example.test',
            employee: { id: 'employee-1' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        eventType: 'COMP_OFF_CREDIT_CREATED',
        payload: { employeeId: 'employee-1' },
      }),
    );

    // Jest stores mock calls as any; cast the captured query for exact scope assertions.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const employeeQuery = prisma.user.findMany.mock.calls[0]?.[0] as {
      where: { employee: { is: Record<string, unknown> } };
    };
    expect(employeeQuery.where.employee.is).toEqual({
      id: 'employee-1',
      isActive: true,
      companyId: 'co-1',
      branchId: 'br-1',
    });
    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: 'employee-user',
        recipientEmployeeId: 'employee-1',
      }),
    ]);
  });

  it('rejects registered workforce events without a supported recipient rule', async () => {
    const result = await buildResolver({}).resolve(
      makeEvent({
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: { leaveRequestId: 'leave-1' },
      }),
    );

    expect(result.recipients).toEqual([]);
    expect(result.exceptions).toEqual([
      expect.objectContaining({ reasonCode: 'UNSUPPORTED_EVENT' }),
    ]);
  });

  it.each([
    'LEAVE_REQUEST_SUBMITTED',
    'HR_REQUEST_APPROVAL_REQUIRED',
    'EMPLOYEE_SEPARATION_CREATED',
    'EMPLOYEE_CLEARANCE_ITEM_REOPENED',
  ])(
    'treats explicit users as authoritative for %s instead of notifying the subject employee',
    async (eventType) => {
      const prisma = {
        user: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'approver-user',
              displayName: 'Approver',
              email: 'approver@example.test',
              normalizedEmail: 'approver@example.test',
              employee: { id: 'approver-employee' },
            },
          ]),
        },
      };

      const result = await buildResolver(prisma).resolve(
        makeEvent({
          eventType,
          payload: {
            recipientUserIds: ['approver-user'],
            employeeId: 'subject-employee',
          },
        }),
      );

      expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
      expect(result.recipients).toEqual([
        expect.objectContaining({ recipientUserId: 'approver-user' }),
      ]);
      expect(
        result.recipients.some(
          (recipient) => recipient.recipientEmployeeId === 'subject-employee',
        ),
      ).toBe(false);
    },
  );

  it('chunks large explicit user lists without truncating recipients', async () => {
    const recipientUserIds = Array.from(
      { length: 501 },
      (_, index) => `user-${index.toString().padStart(3, '0')}`,
    );
    const makeUser = (id: string) => ({
      id,
      displayName: id,
      email: `${id}@example.test`,
      normalizedEmail: `${id}@example.test`,
      employee: { id: `employee-${id}` },
    });
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(recipientUserIds.slice(0, 500).map(makeUser))
          .mockResolvedValueOnce(recipientUserIds.slice(500).map(makeUser)),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        eventType: 'LEAVE_REQUEST_APPROVED',
        payload: { recipientUserIds },
      }),
    );

    expect(prisma.user.findMany).toHaveBeenCalledTimes(2);
    expect(result.recipients).toHaveLength(501);
  });

  it('resolves shift-roster notifications to active users in the exact branch', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'branch-user',
            displayName: 'Branch Employee',
            email: 'branch@example.test',
            normalizedEmail: 'branch@example.test',
            employee: { id: 'branch-employee' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'ShiftRoster',
        aggregateId: 'roster-1',
        eventType: 'SHIFT_ROSTER_PUBLISHED',
        payload: { rosterId: 'roster-1' },
      }),
    );

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: UserStatus.ACTIVE,
          employee: {
            is: {
              isActive: true,
              companyId: 'co-1',
              branchId: 'br-1',
            },
          },
        },
        take: 500,
      }),
    );
    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: 'branch-user',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
  });

  it('pages shift-roster branch recipients in stable id order', async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) => ({
      id: `branch-user-${index.toString().padStart(3, '0')}`,
      displayName: null,
      email: `branch-${index}@example.test`,
      normalizedEmail: `branch-${index}@example.test`,
      employee: { id: `branch-employee-${index}` },
    }));
    const finalUser = {
      id: 'branch-user-500',
      displayName: null,
      email: 'branch-500@example.test',
      normalizedEmail: 'branch-500@example.test',
      employee: { id: 'branch-employee-500' },
    };
    const prisma = {
      user: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce(firstPage)
          .mockResolvedValueOnce([finalUser]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        eventType: 'SHIFT_ROSTER_PUBLISHED',
        payload: { rosterId: 'roster-1' },
      }),
    );

    expect(prisma.user.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        orderBy: { id: 'asc' },
        cursor: { id: 'branch-user-499' },
        skip: 1,
        take: 500,
      }),
    );
    expect(result.recipients).toHaveLength(501);
  });

  it('fails closed for unsupported events instead of using payload recipients', async () => {
    const result = await buildResolver({}).resolve(
      makeEvent({
        eventType: 'leave.approved',
        payload: { recipientUserIds: ['user-1'] },
      }),
    );
    expect(result.recipients).toEqual([]);
    expect(result.exceptions[0]?.reasonCode).toBe('UNSUPPORTED_EVENT');
  });

  it('adds email to an existing Project in-app recipient without changing its scope validation', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'project-user',
            displayName: null,
            email: 'project@example.test',
            normalizedEmail: 'project@example.test',
            employee: {
              id: 'project-employee',
              companyId: 'co-1',
              branchId: 'br-1',
            },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'Project',
        aggregateId: 'project-1',
        eventType: 'projects.project.activated',
        payload: { recipientUserIds: ['project-user'] },
      }),
    );

    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: 'project-user',
        toAddress: 'project@example.test',
        displayName: undefined,
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
  });

  it('keeps payslip delivery on its persisted employee recipient with email plus in-app', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'employee-1',
          firstName: 'Employee',
          lastName: 'One',
          user: {
            id: 'user-1',
            email: 'Employee@Example.test',
            normalizedEmail: 'employee@example.test',
            displayName: 'Employee One',
          },
        }),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'PayrollPayslip',
        aggregateId: 'payslip-1',
        eventType: 'payroll.payslip.available',
        payload: { companyId: 'co-1', employeeId: 'employee-1' },
      }),
    );

    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientEmployeeId: 'employee-1',
        recipientUserId: 'user-1',
        toAddress: 'employee@example.test',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
  });

  it('resolves Finance approvers from persisted transaction scope, not payload recipients', async () => {
    const prisma = {
      financeTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'finance-1',
          companyId: 'co-1',
          branchId: 'br-1',
          createdByUserId: 'creator-db',
          submittedByUserId: 'submitter-db',
          company: { companyGroupId: 'cg-1' },
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'finance-approver-db',
            displayName: 'Finance Approver',
            email: 'finance@example.test',
            normalizedEmail: 'finance@example.test',
            employee: { id: 'employee-approver-db' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'FinanceTransaction',
        aggregateId: 'finance-1',
        eventType: 'office-finance.transaction.submitted',
        payload: { recipientUserIds: ['payload-finance-user'] },
      }),
    );

    expect(prisma.financeTransaction.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'finance-1' } }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(result.recipients).toEqual([
      expect.objectContaining({
        kind: DeliveryRecipientKind.EMPLOYEE,
        recipientId: 'employee-approver-db',
        recipientUserId: 'finance-approver-db',
        toAddress: 'finance@example.test',
        channels: [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP],
      }),
    ]);
    expect(
      result.recipients.some(
        (recipient) => recipient.recipientUserId === 'payload-finance-user',
      ),
    ).toBe(false);
  });

  it('uses the persisted Finance submitter for owner notifications', async () => {
    const prisma = {
      financeTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'finance-1',
          companyId: 'co-1',
          branchId: 'br-1',
          createdByUserId: 'creator-db',
          submittedByUserId: 'submitter-db',
          company: { companyGroupId: 'cg-1' },
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'submitter-db',
            displayName: 'Submitter',
            email: 'submitter@example.test',
            normalizedEmail: 'submitter@example.test',
            employee: { id: 'employee-submitter-db' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'FinanceTransaction',
        aggregateId: 'finance-1',
        eventType: 'office-finance.transaction.approved',
        payload: { recipientUserIds: ['payload-finance-user'] },
      }),
    );

    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: 'submitter-db',
        recipientEmployeeId: 'employee-submitter-db',
      }),
    ]);
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
  });

  it('fails closed when a Finance outbox Branch does not match the transaction', async () => {
    const prisma = {
      financeTransaction: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'finance-1',
          companyId: 'co-1',
          branchId: 'br-db',
          createdByUserId: 'creator-db',
          submittedByUserId: 'submitter-db',
          company: { companyGroupId: 'cg-1' },
        }),
      },
      user: { findMany: jest.fn() },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'FinanceTransaction',
        aggregateId: 'finance-1',
        eventType: 'office-finance.transaction.submitted',
      }),
    );

    expect(result.recipients).toEqual([]);
    expect(result.exceptions[0]?.reasonCode).toBe('TENANT_MISMATCH');
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('resolves period operations users from active Employee role assignments', async () => {
    const prisma = {
      financePeriod: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'period-1',
          companyId: 'co-1',
          company: { companyGroupId: 'cg-1' },
        }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'finance-manager-db',
            displayName: 'Finance Manager',
            email: 'manager@example.test',
            normalizedEmail: 'manager@example.test',
            employee: { id: 'employee-finance-manager-db' },
          },
        ]),
      },
    };

    const result = await buildResolver(prisma).resolve(
      makeEvent({
        aggregateType: 'FinancePeriod',
        aggregateId: 'period-1',
        branchId: null,
        eventType: 'office-finance.period.locked',
        payload: { recipientUserIds: ['payload-finance-user'] },
      }),
    );

    expect(prisma.financePeriod.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'period-1' } }),
    );
    expect(prisma.user.findMany).toHaveBeenCalledTimes(1);
    expect(result.recipients).toEqual([
      expect.objectContaining({
        recipientUserId: 'finance-manager-db',
        recipientEmployeeId: 'employee-finance-manager-db',
      }),
    ]);
  });
});

describe('DeliveryHrRecipientService exact scope', () => {
  it('matches COMPANY/BRANCH/GROUP exactly and excludes GLOBAL by default', () => {
    const service = new DeliveryHrRecipientService({} as never);
    const clauses = service.buildExactScopeFilter(
      { companyGroupId: 'cg-1', companyId: 'co-1', branchId: 'br-1' },
      false,
    );
    expect(clauses).toEqual([
      { scope: RoleScope.COMPANY_GROUP, companyGroupId: 'cg-1' },
      { scope: RoleScope.COMPANY, companyId: 'co-1' },
      { scope: RoleScope.BRANCH, branchId: 'br-1' },
    ]);
    expect(clauses?.some((c) => c.scope === RoleScope.GLOBAL)).toBe(false);
  });

  it('includes GLOBAL only when the registry allows it', () => {
    const service = new DeliveryHrRecipientService({} as never);
    const clauses = service.buildExactScopeFilter(
      { companyGroupId: null, companyId: 'co-1', branchId: null },
      true,
    );
    expect(clauses).toEqual(
      expect.arrayContaining([
        { scope: RoleScope.COMPANY, companyId: 'co-1' },
        { scope: RoleScope.GLOBAL },
      ]),
    );
  });
});
