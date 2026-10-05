import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ProjectsModule } from '../projects/projects.module';

import { ProjectTasksService } from './project-tasks.service';
import { ProjectTaskValidationService } from './services/project-task-validation.service';
import { TaskAssignmentHistoryService } from './services/task-assignment-history.service';
import { TaskParticipantService } from './services/task-participant.service';

/** HTTP controller retired — module not registered in AppModule (PRJ-P0-03). */
@Module({
  imports: [AuditModule, PrismaModule, ProjectsModule],
  providers: [
    ProjectTasksService,
    ProjectTaskValidationService,
    TaskAssignmentHistoryService,
    TaskParticipantService,
  ],
  exports: [ProjectTaskValidationService, TaskParticipantService],
})
export class ProjectTasksModule {}
