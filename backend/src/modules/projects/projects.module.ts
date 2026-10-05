import { Module, forwardRef } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { FileStorageModule } from '../file-storage/file-storage.module';
import { OfficeFinanceModule } from '../office-finance/office-finance.module';
import { OutboxModule } from '../outbox/outbox.module';

import { ProjectsEnabledGuard } from './guards/projects-enabled.guard';
import { ProjectAttachmentsController } from './project-attachments.controller';
import { ProjectMeTasksController } from './project-me-tasks.controller';
import { ProjectMeTimesheetsController } from './project-me-timesheets.controller';
import { ProjectNestedStagesController } from './project-nested-stages.controller';
import { ProjectNestedTasksController } from './project-nested-tasks.controller';
import { ProjectNestedTeamController } from './project-nested-team.controller';
import { ProjectTeamTimesheetsController } from './project-team-timesheets.controller';
import { ProjectsController } from './projects.controller';
import { ProjectCommandReceiptService } from './services/project-command-receipt.service';
import { ProjectDocumentService } from './services/project-document.service';
import { ProjectEligibilityService } from './services/project-eligibility.service';
import { ProjectNotificationService } from './services/project-notification.service';
import { ProjectStageCommandService } from './services/project-stage-command.service';
import { ProjectSummaryService } from './services/project-summary.service';
import { ProjectTaskCommandService } from './services/project-task-command.service';
import { ProjectTeamCommandService } from './services/project-team-command.service';
import { ProjectTimesheetCommandService } from './services/project-timesheet-command.service';
import { ProjectTimesheetQueryService } from './services/project-timesheet-query.service';
import { ProjectTimePolicyService } from './services/project-time-policy.service';
import { ProjectTaskReminderJobService } from './services/project-task-reminder-job.service';
import { ProjectsActorContextService } from './services/projects-actor-context.service';
import { ProjectsDomainScopeService } from './services/projects-domain-scope.service';
import { ProjectsFeatureGateService } from './services/projects-feature-gate.service';
import { ProjectsLifecycleService } from './services/projects-lifecycle.service';
import { ProjectsQueryService } from './services/projects-query.service';
import { ProjectsWorkspaceCapabilitiesService } from './services/projects-workspace-capabilities.service';

@Module({
  imports: [
    PrismaModule,
    AttendanceModule,
    forwardRef(() => OutboxModule),
    forwardRef(() => FileStorageModule),
    forwardRef(() => OfficeFinanceModule),
  ],
  controllers: [
    ProjectsController,
    ProjectAttachmentsController,
    ProjectNestedStagesController,
    ProjectNestedTeamController,
    ProjectNestedTasksController,
    ProjectMeTasksController,
    ProjectMeTimesheetsController,
    ProjectTeamTimesheetsController,
  ],
  providers: [
    ProjectsFeatureGateService,
    ProjectsEnabledGuard,
    ProjectsActorContextService,
    ProjectsDomainScopeService,
    ProjectCommandReceiptService,
    ProjectsQueryService,
    ProjectsLifecycleService,
    ProjectStageCommandService,
    ProjectTeamCommandService,
    ProjectTaskCommandService,
    ProjectEligibilityService,
    ProjectTimesheetQueryService,
    ProjectTimePolicyService,
    ProjectTaskReminderJobService,
    ProjectTimesheetCommandService,
    ProjectDocumentService,
    ProjectSummaryService,
    ProjectNotificationService,
    ProjectsWorkspaceCapabilitiesService,
  ],
  exports: [
    ProjectsFeatureGateService,
    ProjectsEnabledGuard,
    ProjectTimesheetCommandService,
    ProjectNotificationService,
    ProjectTaskReminderJobService,
  ],
})
export class ProjectsModule {}
