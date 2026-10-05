import { UserStatus } from '@prisma/client';

import { RecruitmentDeliveryProcessor } from '../../src/modules/recruitment/services/recruitment-delivery.processor';

// ---------------------------------------------------------------------------
// Shared mock builders
// ---------------------------------------------------------------------------

function makeEvent(
  eventType: string,
  interviewSessionId = 'session-1',
  candidateId = 'cand-1',
) {
  return {
    id: 'event-1',
    eventType,
    aggregateType: 'recruitment',
    aggregateId: interviewSessionId,
    dedupeKey: `recruitment:interview-scheduled:${interviewSessionId}`,
    companyGroupId: 'cg-1',
    companyId: 'co-1',
    branchId: 'br-1',
    payload: {
      interviewSessionId,
      candidateId,
      jobApplicationId: 'app-1',
      recipientUserIds: ['user-panel-1'],
    },
  };
}

function makeSession(
  overrides: {
    panelMembers?: Array<{
      id?: string;
      employeeId?: string;
      employee?: {
        id?: string;
        isActive?: boolean;
        companyId?: string;
        branchId?: string;
        user?: {
          id?: string;
          email?: string;
          displayName?: string;
          status?: string;
        } | null;
      };
    }>;
  } = {},
) {
  return {
    roundName: 'Technical Round',
    scheduledStartAt: new Date('2026-09-01T10:00:00Z'),
    jobApplication: {
      companyId: 'co-1',
      branchId: 'br-1',
      jobOpening: {
        title: 'Software Engineer',
        companyId: 'co-1',
        branchId: 'br-1',
      },
      candidate: { firstName: 'Jane', lastName: 'Doe' },
    },
    panelMembers: overrides.panelMembers ?? [
      {
        id: 'pm-1',
        employeeId: 'emp-1',
        employee: {
          id: 'emp-1',
          isActive: true,
          companyId: 'co-1',
          branchId: 'br-1',
          user: {
            id: 'user-panel-1',
            email: 'panel@example.test',
            displayName: 'Panel Member',
            status: UserStatus.ACTIVE,
          },
        },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPrisma = {
  user: { findMany: jest.fn() },
  interviewSession: { findUnique: jest.fn() },
  candidate: { findUnique: jest.fn() },
  jobOffer: { findUnique: jest.fn() },
  recruitmentDeliveryAttempt: { update: jest.fn() },
};

const mockMail = {
  sendRecruitmentMessage: jest.fn(
    (args: { to: string; subject: string; clientReference?: string }) => {
      void args;
      return Promise.resolve('SENT');
    },
  ),
};

const mockNotifications = {
  create: jest.fn(),
};

const mockCrypto = {
  decrypt: jest.fn(),
};

const mockConfig = {
  getOrThrow: jest.fn().mockReturnValue('http://localhost:3000'),
};

function buildProcessor() {
  return new RecruitmentDeliveryProcessor(
    mockPrisma as never,
    mockMail as never,
    mockNotifications as never,
    mockCrypto as never,
    mockConfig as never,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RecruitmentDeliveryProcessor — panel email (Phase C)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: no candidate email (no candidateId in payload for simplicity)
    mockPrisma.candidate.findUnique.mockResolvedValue(null);

    // Default in-app recipient resolution → empty for simplicity
    mockPrisma.user.findMany.mockResolvedValue([]);

    // Default mail
    mockMail.sendRecruitmentMessage.mockResolvedValue('SENT');
  });

  it('sends email to active panel member when interview is scheduled', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(makeSession());

    const processor = buildProcessor();
    await processor.process(event as never);

    const [scheduledArg] = mockMail.sendRecruitmentMessage.mock.calls;
    expect(scheduledArg[0].to).toBe('panel@example.test');
    expect(scheduledArg[0].subject).toContain('scheduled');
    expect(scheduledArg[0].clientReference).toContain(
      'panel-email:session-1:pm-1',
    );
  });

  it('sends email to active panel member when interview is rescheduled', async () => {
    const event = makeEvent('recruitment.interview.rescheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(makeSession());

    const processor = buildProcessor();
    await processor.process(event as never);

    const [rescheduledArg] = mockMail.sendRecruitmentMessage.mock.calls;
    expect(rescheduledArg[0].to).toBe('panel@example.test');
    expect(rescheduledArg[0].subject).toContain('updated');
  });

  it('sends email to active panel member when interview is cancelled', async () => {
    const event = makeEvent('recruitment.interview.cancelled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(makeSession());

    const processor = buildProcessor();
    await processor.process(event as never);

    const [cancelledArg] = mockMail.sendRecruitmentMessage.mock.calls;
    expect(cancelledArg[0].to).toBe('panel@example.test');
    expect(cancelledArg[0].subject).toContain('cancelled');
  });

  it('does not send panel email for non-interview events', async () => {
    const event = makeEvent('recruitment.application.received');
    mockPrisma.candidate.findUnique.mockResolvedValue(null);

    const processor = buildProcessor();
    await processor.process(event as never);

    // findUnique for session should not be called
    expect(mockPrisma.interviewSession.findUnique).not.toHaveBeenCalled();
    // No panel email sent
    expect(mockMail.sendRecruitmentMessage).not.toHaveBeenCalled();
  });

  it('skips inactive employee', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      makeSession({
        panelMembers: [
          {
            id: 'pm-1',
            employeeId: 'emp-1',
            employee: {
              id: 'emp-1',
              isActive: false, // inactive
              companyId: 'co-1',
              branchId: 'br-1',
              user: {
                id: 'user-panel-1',
                email: 'panel@example.test',
                displayName: 'Panel Member',
                status: UserStatus.ACTIVE,
              },
            },
          },
        ],
      }),
    );

    const processor = buildProcessor();
    await processor.process(event as never);

    expect(mockMail.sendRecruitmentMessage).not.toHaveBeenCalled();
  });

  it('skips panel member with no linked User', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      makeSession({
        panelMembers: [
          {
            id: 'pm-1',
            employeeId: 'emp-1',
            employee: {
              id: 'emp-1',
              isActive: true,
              companyId: 'co-1',
              branchId: 'br-1',
              user: null, // no user
            },
          },
        ],
      }),
    );

    const processor = buildProcessor();
    await processor.process(event as never);

    expect(mockMail.sendRecruitmentMessage).not.toHaveBeenCalled();
  });

  it('skips panel member whose User has no email', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      makeSession({
        panelMembers: [
          {
            id: 'pm-1',
            employeeId: 'emp-1',
            employee: {
              id: 'emp-1',
              isActive: true,
              companyId: 'co-1',
              branchId: 'br-1',
              user: {
                id: 'user-panel-1',
                email: null as unknown as string, // no email
                displayName: 'Panel Member',
                status: UserStatus.ACTIVE,
              },
            },
          },
        ],
      }),
    );

    const processor = buildProcessor();
    await processor.process(event as never);

    expect(mockMail.sendRecruitmentMessage).not.toHaveBeenCalled();
  });

  it('skips panel member from a different company', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      makeSession({
        panelMembers: [
          {
            id: 'pm-1',
            employeeId: 'emp-1',
            employee: {
              id: 'emp-1',
              isActive: true,
              companyId: 'other-company', // different company
              branchId: 'br-1',
              user: {
                id: 'user-panel-1',
                email: 'panel@example.test',
                displayName: 'Panel Member',
                status: UserStatus.ACTIVE,
              },
            },
          },
        ],
      }),
    );

    const processor = buildProcessor();
    await processor.process(event as never);

    expect(mockMail.sendRecruitmentMessage).not.toHaveBeenCalled();
  });

  it('continues delivering to other members if one send fails', async () => {
    const event = makeEvent('recruitment.interview.scheduled');
    mockPrisma.interviewSession.findUnique.mockResolvedValue(
      makeSession({
        panelMembers: [
          {
            id: 'pm-1',
            employeeId: 'emp-1',
            employee: {
              id: 'emp-1',
              isActive: true,
              companyId: 'co-1',
              branchId: 'br-1',
              user: {
                id: 'user-1',
                email: 'panel1@example.test',
                displayName: 'Panel One',
                status: UserStatus.ACTIVE,
              },
            },
          },
          {
            id: 'pm-2',
            employeeId: 'emp-2',
            employee: {
              id: 'emp-2',
              isActive: true,
              companyId: 'co-1',
              branchId: 'br-1',
              user: {
                id: 'user-2',
                email: 'panel2@example.test',
                displayName: 'Panel Two',
                status: UserStatus.ACTIVE,
              },
            },
          },
        ],
      }),
    );

    // First send fails, second should still go
    mockMail.sendRecruitmentMessage
      .mockRejectedValueOnce(new Error('SMTP_ERROR'))
      .mockResolvedValueOnce('SENT');

    const processor = buildProcessor();
    await expect(processor.process(event as never)).resolves.not.toThrow();

    expect(mockMail.sendRecruitmentMessage).toHaveBeenCalledTimes(2);
    expect(mockMail.sendRecruitmentMessage).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'panel2@example.test' }),
    );
  });
});
