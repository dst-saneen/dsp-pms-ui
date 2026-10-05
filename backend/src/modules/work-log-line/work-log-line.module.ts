import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { WorkLogHeaderModule } from '../work-log-header/work-log-header.module';

import { WorkLogLineService } from './work-log-line.service';

/** HTTP controller retired — module not registered in AppModule (PRJ-P0-03). */
@Module({
  imports: [PrismaModule, WorkLogHeaderModule, ProjectsModule],
  providers: [WorkLogLineService],
  exports: [WorkLogLineService],
})
export class WorkLogLineModule {}
