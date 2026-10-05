import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { WorkforceJobsScheduler } from './workforce-jobs.scheduler';

describe('WorkforceJobsScheduler', () => {
  const configService = {
    get: jest.fn(),
  };
  const outboxProcessor = {
    processBatch: jest.fn(),
  };
  const attendanceFinalizer = {
    finalizeBatch: jest.fn(),
  };
  const compOffCreditService = {
    expireCredits: jest.fn(),
  };
  const offerService = {
    expireSentOffers: jest.fn(),
  };
  const metrics = {
    recordOutboxProcessed: jest.fn(),
    recordOutboxFailed: jest.fn(),
    recordAttendanceFinalizer: jest.fn(),
    recordCompOffExpired: jest.fn(),
    snapshot: jest.fn().mockReturnValue({ outboxProcessed: 0 }),
  };
  const prisma = {
    branch: { findMany: jest.fn() },
  };

  const onboardingReminderJob = {
    runDueReminders: jest.fn(),
  };
  const fileScanWorker = {
    processDueScans: jest.fn(),
  };
  const fileRetention = {
    runExpiredSessionCleanup: jest.fn(),
    runUnreferencedObjectPurge: jest.fn(),
  };
  const generatedFiles = {
    reconcilePendingDeletes: jest.fn(),
  };
  const projectTaskReminders = {
    runDueReminders: jest.fn(),
  };
  const optionalHolidayReminders = {
    runDueReminders: jest.fn(),
  };

  const scheduler = new WorkforceJobsScheduler(
    configService as never,
    outboxProcessor as never,
    attendanceFinalizer as never,
    compOffCreditService as never,
    offerService as never,
    onboardingReminderJob as never,
    metrics as never,
    prisma as never,
    fileScanWorker as never,
    fileRetention as never,
    generatedFiles as never,
    projectTaskReminders as never,
    optionalHolidayReminders as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.branch.findMany.mockResolvedValue([]);
    configService.get.mockImplementation((key: string) => {
      if (key === 'WORKFORCE_JOBS_ENABLED') return false;
      if (key === 'WORKFORCE_JOB_BATCH_SIZE') return 100;
      if (key === 'ATTENDANCE_FINALIZER_INTERVAL_MINUTES') return 15;
      return undefined;
    });
  });

  it('skips jobs when WORKFORCE_JOBS_ENABLED is false', async () => {
    await scheduler.runOutboxProcessor();
    await scheduler.runAttendanceFinalizer();
    await scheduler.runCompOffExpiry();
    await scheduler.runProjectTaskReminders();
    await scheduler.runOptionalHolidayReminders();

    expect(outboxProcessor.processBatch).not.toHaveBeenCalled();
    expect(attendanceFinalizer.finalizeBatch).not.toHaveBeenCalled();
    expect(compOffCreditService.expireCredits).not.toHaveBeenCalled();
    expect(projectTaskReminders.runDueReminders).not.toHaveBeenCalled();
    expect(optionalHolidayReminders.runDueReminders).not.toHaveBeenCalled();
  });

  it('runs outbox processor when enabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'WORKFORCE_JOBS_ENABLED') return true;
      if (key === 'WORKFORCE_JOB_BATCH_SIZE') return 50;
      return undefined;
    });
    outboxProcessor.processBatch.mockResolvedValue({
      claimed: 2,
      processed: 2,
      failed: 0,
      recovered: 0,
    });

    await scheduler.runOutboxProcessor();

    expect(outboxProcessor.processBatch).toHaveBeenCalled();
    expect(metrics.recordOutboxProcessed).toHaveBeenCalledTimes(2);
  });

  it('runs optional holiday reminders when enabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'WORKFORCE_JOBS_ENABLED') return true;
      return undefined;
    });
    optionalHolidayReminders.runDueReminders.mockResolvedValue({
      scanned: 3,
      queued: 1,
    });

    await scheduler.runOptionalHolidayReminders();

    expect(optionalHolidayReminders.runDueReminders).toHaveBeenCalled();
  });

  it('logs a Prisma code without the outbox error message', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'WORKFORCE_JOBS_ENABLED') return true;
      return undefined;
    });
    outboxProcessor.processBatch.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'database host and password must not leak',
        { code: 'P2025', clientVersion: 'test' },
      ),
    );
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation();

    await scheduler.runOutboxProcessor();

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('job=outbox failed'),
    );
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('code=P2025'),
    );
    expect(JSON.stringify(loggerError.mock.calls)).not.toContain(
      'database host and password must not leak',
    );
    loggerError.mockRestore();
  });

  it('expires comp-off credits only for branches with a valid configured timezone', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'WORKFORCE_JOBS_ENABLED') return true;
      return undefined;
    });
    prisma.branch.findMany.mockResolvedValue([
      { id: 'br-missing', timezone: null },
      { id: 'br-india', timezone: 'Asia/Kolkata' },
      { id: 'br-uae', timezone: 'Asia/Dubai' },
    ]);
    compOffCreditService.expireCredits.mockResolvedValue({ expiredCount: 1 });

    await scheduler.runCompOffExpiry();

    expect(compOffCreditService.expireCredits).toHaveBeenCalledTimes(2);
    expect(compOffCreditService.expireCredits).toHaveBeenNthCalledWith(
      1,
      expect.any(Date),
      'br-india',
    );
    expect(compOffCreditService.expireCredits).toHaveBeenNthCalledWith(
      2,
      expect.any(Date),
      'br-uae',
    );
    expect(compOffCreditService.expireCredits).not.toHaveBeenCalledWith(
      expect.any(Date),
      'br-missing',
    );
  });
});
