import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

import { TaskReviewsService } from './task-reviews.service';

/** HTTP controller retired — module not registered in AppModule (PRJ-P0-03). */
@Module({
  imports: [PrismaModule, ProjectsModule],
  providers: [TaskReviewsService],
})
export class TaskReviewsModule {}
