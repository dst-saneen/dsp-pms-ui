import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

import { WorkLogHeaderService } from './work-log-header.service';

/** HTTP controller retired (PRJ-P0-03). Service kept for TaskWorkSession internals only. */
@Module({
  imports: [PrismaModule, ProjectsModule],
  providers: [WorkLogHeaderService],
  exports: [WorkLogHeaderService],
})
export class WorkLogHeaderModule {}
