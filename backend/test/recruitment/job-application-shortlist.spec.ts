import { ApplicationSource, JobApplicationStatus } from '@prisma/client';

import { DomainConflictException } from '../../src/common';
import { JobApplicationTransitionService } from '../../src/modules/recruitment/transitions/job-application-transition.service';

type ApplicationRow = {
  id: string;
  version: number;
  status: JobApplicationStatus;
  candidateId: string;
  jobOpeningId: string;
  source: ApplicationSource;
  coverNote: string | null;
  privacyAcknowledgedAt: Date | null;
  privacyAckVersion: string | null;
  submittedAt: Date | null;
  shortlistedAt: Date | null;
  screeningStartedAt: Date | null;
  selectedAt: Date | null;
  offerSentAt: Date | null;
  offerAcceptedAt: Date | null;
  hiredAt: Date | null;
  employeeId: string | null;
  applicationCode: string;
  createdAt: Date;
  updatedAt: Date;
};

const mockApplicationBase: ApplicationRow = {
  id: 'app-1',
  version: 1,
  status: JobApplicationStatus.APPLIED,
  candidateId: 'cand-1',
  jobOpeningId: 'opening-1',
  source: ApplicationSource.HR_INTERNAL,
  coverNote: null,
  privacyAcknowledgedAt: null,
  privacyAckVersion: null,
  submittedAt: null,
  shortlistedAt: null,
  screeningStartedAt: null,
  selectedAt: null,
  offerSentAt: null,
  offerAcceptedAt: null,
  hiredAt: null,
  employeeId: null,
  applicationCode: 'APP-001',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPrisma = {
  jobApplication: {
    update: jest.fn((args: { data: Partial<typeof mockApplicationBase> }) => ({
      ...mockApplicationBase,
      ...args.data,
      version: (mockApplicationBase.version ?? 1) + 1,
    })),
    findUniqueOrThrow: jest.fn(),
  },
  jobOpening: {
    findUnique: jest.fn().mockResolvedValue({
      companyId: 'co-1',
      branchId: 'br-1',
    }),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ companyId: 'co-1' }),
  },
  jobApplicationStatusHistory: {
    create: jest.fn(),
  },
  recruitmentCommandReceipt: {
    findUnique: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'rcpt-1' }),
    update: jest.fn().mockResolvedValue({}),
  },
  $transaction: jest.fn(),
};

const mockScope = {
  assertJobApplicationInScope: jest.fn((): Promise<ApplicationRow> =>
    Promise.resolve(mockApplicationBase),
  ),
};

const mockAudit = {
  log: jest.fn(),
};

const mockInterviewPrerequisites = {
  assertRequiredInterviewsComplete: jest.fn(),
};

jest.mock('../../src/common', () => {
  const actual =
    jest.requireActual<typeof import('../../src/common')>('../../src/common');
  return {
    ...actual,
    getRequestActor: (): { userId: string; companyId: string } => ({
      userId: 'user-1',
      companyId: 'co-1',
    }),
    getRequestId: (): string => 'req-1',
  };
});

const mockReceipts = {
  claimOrReplay: jest.fn(
    async (input: {
      execute: (tx: typeof mockPrisma) => Promise<{ result: unknown }>;
    }) => {
      const executed = await input.execute(mockPrisma);
      return executed.result;
    },
  ),
};

const mockShortlistGate = {
  isEnabledForCompany: jest.fn().mockResolvedValue(true),
};

const mockFeatureGate = {
  isEnabledForCompany: jest.fn().mockResolvedValue(true),
  assertEnabledForCompany: jest.fn().mockResolvedValue(undefined),
};

function buildService() {
  mockPrisma.$transaction.mockImplementation(
    (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
  );
  mockPrisma.jobApplication.update.mockImplementation(
    (args: { data: Partial<typeof mockApplicationBase> }) => ({
      ...mockApplicationBase,
      ...args.data,
      version: (mockApplicationBase.version ?? 1) + 1,
    }),
  );
  mockPrisma.jobApplication.findUniqueOrThrow.mockImplementation(async () => {
    const last = mockScope.assertJobApplicationInScope.mock.results.at(-1);
    const scoped = (await last?.value) as ApplicationRow | undefined;
    return scoped ?? mockApplicationBase;
  });

  mockPrisma.jobApplicationStatusHistory.create.mockResolvedValue({});
  mockAudit.log.mockResolvedValue(undefined);

  return new JobApplicationTransitionService(
    mockPrisma as never,
    mockScope as never,
    mockFeatureGate as never,
    mockAudit as never,
    mockInterviewPrerequisites as never,
    mockReceipts as never,
    mockShortlistGate as never,
  );
}

function cmd(version = 1) {
  return {
    expectedVersion: version,
    operationId: '11111111-1111-4111-8111-111111111111',
  };
}

describe('JobApplicationTransitionService — shortlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureGate.isEnabledForCompany.mockResolvedValue(true);
    mockFeatureGate.assertEnabledForCompany.mockResolvedValue(undefined);
    mockShortlistGate.isEnabledForCompany.mockResolvedValue(true);
    mockReceipts.claimOrReplay.mockImplementation(
      async (input: {
        execute: (tx: typeof mockPrisma) => Promise<{ result: unknown }>;
      }) => {
        const executed = await input.execute(mockPrisma);
        return executed.result;
      },
    );
  });

  it('transitions APPLIED → SHORTLISTED and sets shortlistedAt', async () => {
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });
    mockPrisma.jobApplication.findUniqueOrThrow.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });

    const svc = buildService();
    const result = await svc.shortlist('app-1', {
      ...cmd(1),
      comment: 'Looks good',
    });

    expect(result.record.status).toBe(JobApplicationStatus.SHORTLISTED);
    const [updateArg] = mockPrisma.jobApplication.update.mock.calls;
    expect(updateArg[0].data).toMatchObject({
      status: JobApplicationStatus.SHORTLISTED,
    });
    expect(updateArg[0].data.shortlistedAt).toBeInstanceOf(Date);
    expect(result.allowedActions).toContain('start-screening');
    expect(result.allowedActions).not.toContain('shortlist');
  });

  it('rejects SHORTLISTED → SHORTLISTED (invalid transition)', async () => {
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.SHORTLISTED,
    });
    mockPrisma.jobApplication.findUniqueOrThrow.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.SHORTLISTED,
    });

    const svc = buildService();
    await expect(svc.shortlist('app-1', cmd(1))).rejects.toBeInstanceOf(
      DomainConflictException,
    );
  });

  it('rejects APPLIED → SHORTLISTED when expectedVersion does not match', async () => {
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
      version: 3,
    });

    const svc = buildService();
    await expect(svc.shortlist('app-1', cmd(1))).rejects.toBeInstanceOf(
      DomainConflictException,
    );
  });

  it('transitions SHORTLISTED → SCREENING via startScreening', async () => {
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.SHORTLISTED,
      shortlistedAt: new Date(),
    });
    mockPrisma.jobApplication.findUniqueOrThrow.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.SHORTLISTED,
    });

    const svc = buildService();
    const result = await svc.startScreening('app-1', cmd(1));

    expect(result.record.status).toBe(JobApplicationStatus.SCREENING);
    expect(result.allowedActions).toContain('advance-to-interview');
  });

  it('rejects APPLIED → SCREENING directly when shortlist is enabled', async () => {
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });
    mockPrisma.jobApplication.findUniqueOrThrow.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });

    const svc = buildService();
    await expect(svc.startScreening('app-1', cmd(1))).rejects.toBeInstanceOf(
      DomainConflictException,
    );
  });

  it('allows APPLIED → SCREENING when shortlist entitlement is absent', async () => {
    mockShortlistGate.isEnabledForCompany.mockResolvedValue(false);
    mockScope.assertJobApplicationInScope.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });
    mockPrisma.jobApplication.findUniqueOrThrow.mockResolvedValue({
      ...mockApplicationBase,
      status: JobApplicationStatus.APPLIED,
    });

    const svc = buildService();
    const result = await svc.startScreening('app-1', cmd(1));
    expect(result.record.status).toBe(JobApplicationStatus.SCREENING);
  });

  it('does not advertise actions without the Recruitment entitlement', async () => {
    mockFeatureGate.isEnabledForCompany.mockResolvedValue(false);

    const result = await buildService().withAllowedActions(
      mockApplicationBase,
      'co-1',
    );

    expect(result.allowedActions).toEqual([]);
    expect(mockShortlistGate.isEnabledForCompany).not.toHaveBeenCalled();
  });
});
