import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';

import { ProjectTeamMembersService } from './project-team-members.service';

/** HTTP controller retired — module not registered in AppModule (PRJ-P0-03). */
@Module({
  imports: [PrismaModule, ProjectsModule],
  providers: [ProjectTeamMembersService],
})
export class ProjectTeamMembersModule {}
