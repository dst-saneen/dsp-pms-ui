import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';

import { Environment } from '../../config';
import { AttendanceFinalizerService } from '../attendance/attendance-finalizer.service';
import { CompOffCreditService } from '../comp-off/comp-off-credit.service';
import { OnboardingReminderJobService } from '../onboarding-runtime/services/onboarding-reminder-job.service';
import { OptionalHolidayReminderService } from '../optional-holiday/optional-holiday-reminder.service';
import { OutboxProcessorService } from '../outbox/outbox-processor.service';
import { OfferService } from '../recruitment/offer/offer.service';
import { FileScanWorker } from '../file-storage/workers/file-scan.worker';
import { FileRetentionService } from '../file-storage/services/file-retention.service';
import { GeneratedFileService } from '../file-storage/services/generated-file.service';
import { ProjectTaskReminderJobService } from '../projects/services/project-task-reminder-job.service';
import { isValidIanaTimeZone } from '../leave-policy/leave-calendar.util';
import { PrismaService } from '../../prisma/prisma.service';

import { WorkforceJobMetricsService } from './workforce-job-metrics.service';

@Injectable()
export class WorkforceJobsScheduler {
  private readonly logger = new Logger(WorkforceJobsScheduler.name);
  private outboxRunning = false;
  private finalizerRunning = false;
  private expiryRunning = false;
  private offerExpiryRunning = false;
  private onboardingReminderRunning = false;
  private fileScanRunning = false;
  private fileRetentionRunning = false;
  private generatedFileReaperRunning = false;
  private projectTaskReminderRunning = false;
  private optionalHolidayReminderRunning = false;

  constructor(
    private readonly configService: ConfigService<Environment, true>,
    private readonly outboxProcessor: OutboxProcessorService,
    private readonly attendanceFinalizer: AttendanceFinalizerService,
    private readonly compOffCreditService: CompOffCreditService,
    private readonly offerService: OfferService,
    private readonly onboardingReminderJob: OnboardingReminderJobService,
    private readonly metrics: WorkforceJobMetricsService,
    private readonly prisma: PrismaService,
    private readonly fileScanWorker: FileScanWorker,
    private readonly fileRetention: FileRetentionService,
    private readonly generatedFiles: GeneratedFileService,
    private readonly projectTaskReminders: ProjectTaskReminderJobService,
    private readonly optionalHolidayReminders: OptionalHolidayReminderService,
  ) {}

  private jobsEnabled(): boolean {
    return this.configService.get('WORKFORCE_JOBS_ENABLED', { infer: true });
  }

  private errorCode(error: unknown): string {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return error.code;
    }

    return error instanceof Error ? error.name : 'UNKNOWN';
  }

  /** Every minute; individual outbox records remain gated by their availableAt timestamp. */
  @Cron(CronExpression.EVERY_MINUTE)
  async runOutboxProcessor() {
    if (!this.jobsEnabled() || this.outboxRunning) {
      return;
    }
    this.outboxRunning = true;
    const started = Date.now();
    try {
      const result = await this.outboxProcessor.processBatch();
      for (let i = 0; i < result.processed; i += 1) {
        this.metrics.recordOutboxProcessed();
      }
      for (let i = 0; i < result.failed; i += 1) {
        this.metrics.recordOutboxFailed();
      }
      this.logger.log(
        `job=outbox durationMs=${Date.now() - started} claimed=${result.claimed} processed=${result.processed} failed=${result.failed}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=outbox failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.outboxRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runAttendanceFinalizer() {
    if (!this.jobsEnabled() || this.finalizerRunning) {
      return;
    }

    const intervalMinutes = this.configService.get(
      'ATTENDANCE_FINALIZER_INTERVAL_MINUTES',
      { infer: true },
    );
    // Cron is every 10 minutes; skip ticks that are not multiples of configured interval.
    const minuteOfDay =
      new Date().getUTCMinutes() + new Date().getUTCHours() * 60;
    if (intervalMinutes > 10 && minuteOfDay % intervalMinutes !== 0) {
      return;
    }

    this.finalizerRunning = true;
    const started = Date.now();
    try {
      const batchSize = this.configService.get('WORKFORCE_JOB_BATCH_SIZE', {
        infer: true,
      });
      const result = await this.attendanceFinalizer.finalizeBatch(batchSize);
      this.metrics.recordAttendanceFinalizer(result.processed, result.skipped);
      this.logger.log(
        `job=attendance_finalizer durationMs=${Date.now() - started} processed=${result.processed} skipped=${result.skipped}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=attendance_finalizer failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.finalizerRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runOfferExpiry() {
    if (!this.jobsEnabled() || this.offerExpiryRunning) {
      return;
    }

    this.offerExpiryRunning = true;
    const started = Date.now();

    try {
      const result = await this.offerService.expireSentOffers();
      this.logger.log(
        `job=offer_expiry durationMs=${Date.now() - started} expired=${result.expiredCount}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=offer_expiry failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.offerExpiryRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runOnboardingReminders() {
    if (!this.jobsEnabled() || this.onboardingReminderRunning) {
      return;
    }

    this.onboardingReminderRunning = true;
    const started = Date.now();

    try {
      const result = await this.onboardingReminderJob.runDueReminders();
      this.logger.log(
        `job=onboarding_reminders durationMs=${Date.now() - started} scanned=${result.scanned} queued=${result.queued}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=onboarding_reminders failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.onboardingReminderRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runProjectTaskReminders() {
    if (!this.jobsEnabled() || this.projectTaskReminderRunning) {
      return;
    }

    this.projectTaskReminderRunning = true;
    const started = Date.now();
    try {
      const result = await this.projectTaskReminders.runDueReminders();
      this.logger.log(
        `job=project_task_reminders durationMs=${Date.now() - started} scanned=${result.scanned} queued=${result.queued}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=project_task_reminders failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.projectTaskReminderRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runOptionalHolidayReminders() {
    if (!this.jobsEnabled() || this.optionalHolidayReminderRunning) {
      return;
    }

    this.optionalHolidayReminderRunning = true;
    const started = Date.now();
    try {
      const result = await this.optionalHolidayReminders.runDueReminders();
      this.logger.log(
        `job=optional_holiday_reminders durationMs=${Date.now() - started} scanned=${result.scanned} queued=${result.queued}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=optional_holiday_reminders failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.optionalHolidayReminderRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runCompOffExpiry() {
    if (!this.jobsEnabled() || this.expiryRunning) {
      return;
    }
    this.expiryRunning = true;
    const started = Date.now();
    try {
      // Branch-date aware: expire only for branches with a configured IANA
      // timezone. An unconfigured branch must never be evaluated against UTC.
      const branches = await this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, timezone: true },
        take: 500,
      });

      let totalExpired = 0;
      let skippedMissingTimezone = 0;

      for (const branch of branches) {
        const timezone = branch.timezone?.trim() ?? '';
        if (!timezone || !isValidIanaTimeZone(timezone)) {
          skippedMissingTimezone += 1;
          this.logger.warn(
            `job=comp_off_expiry skipped_branch=${branch.id} reason=BRANCH_TIMEZONE_REQUIRED`,
          );
          continue;
        }

        const asOf = this.businessDateInTimezone(new Date(), timezone);
        const result = await this.compOffCreditService.expireCredits(
          asOf,
          branch.id,
        );
        totalExpired += result.expiredCount;
      }

      if (branches.length === 0) {
        this.logger.warn(
          'job=comp_off_expiry skipped reason=NO_ACTIVE_BRANCHES',
        );
      }

      this.metrics.recordCompOffExpired(totalExpired);
      this.logger.log(
        `job=comp_off_expiry durationMs=${Date.now() - started} expired=${totalExpired} skippedMissingTimezone=${skippedMissingTimezone}`,
      );
    } catch (error) {
      const errorCode = this.errorCode(error);
      this.logger.error(
        `job=comp_off_expiry failed durationMs=${Date.now() - started} code=${errorCode}`,
      );
    } finally {
      this.expiryRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runFileScanWorker() {
    if (!this.jobsEnabled() || this.fileScanRunning) {
      return;
    }
    this.fileScanRunning = true;
    try {
      await this.fileScanWorker.processDueAttempts();
    } catch (error) {
      this.logger.error(`job=file_scan failed code=${this.errorCode(error)}`);
    } finally {
      this.fileScanRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runGeneratedFileDeleteReaper() {
    if (!this.jobsEnabled() || this.generatedFileReaperRunning) {
      return;
    }
    this.generatedFileReaperRunning = true;
    try {
      await this.generatedFiles.reconcilePendingDeletes();
    } catch (error) {
      this.logger.error(
        `job=generated_file_delete_reaper failed code=${this.errorCode(error)}`,
      );
    } finally {
      this.generatedFileReaperRunning = false;
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async runFileRetentionJobs() {
    if (!this.jobsEnabled() || this.fileRetentionRunning) {
      return;
    }
    this.fileRetentionRunning = true;
    try {
      await this.fileRetention.runExpiredSessionCleanup();
      const companies = await this.prisma.company.findMany({
        select: { id: true },
        take: 50,
      });
      for (const company of companies) {
        await this.fileRetention.runUnreferencedObjectPurge(company.id);
      }
    } catch (error) {
      this.logger.error(
        `job=file_retention failed code=${this.errorCode(error)}`,
      );
    } finally {
      this.fileRetentionRunning = false;
    }
  }

  getHealth() {
    return {
      jobsEnabled: this.jobsEnabled(),
      metrics: this.metrics.snapshot(),
    };
  }

  private businessDateInTimezone(now: Date, timeZone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const day = Number(parts.find((p) => p.type === 'day')?.value);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
