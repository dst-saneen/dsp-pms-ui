import { Module, forwardRef } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { CompOffModule } from '../comp-off/comp-off.module';
import { OnboardingRuntimeModule } from '../onboarding-runtime/onboarding-runtime.module';
import { OptionalHolidayModule } from '../optional-holiday/optional-holiday.module';
import { OutboxModule } from '../outbox/outbox.module';
import { RecruitmentModule } from '../recruitment/recruitment.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { ProjectsModule } from '../projects/projects.module';

import { WorkforceJobMetricsService } from './workforce-job-metrics.service';
import { WorkforceJobsController } from './workforce-jobs.controller';
import { WorkforceJobsScheduler } from './workforce-jobs.scheduler';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    forwardRef(() => OutboxModule),
    AttendanceModule,
    CompOffModule,
    OptionalHolidayModule,
    forwardRef(() => RecruitmentModule),
    forwardRef(() => OnboardingRuntimeModule),
    forwardRef(() => FileStorageModule),
    ProjectsModule,
  ],
  controllers: [WorkforceJobsController],
  providers: [WorkforceJobMetricsService, WorkforceJobsScheduler],
  exports: [WorkforceJobMetricsService, WorkforceJobsScheduler],
})
export class WorkforceJobsModule {}
