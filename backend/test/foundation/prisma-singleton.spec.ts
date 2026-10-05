import 'reflect-metadata';

import { MODULE_METADATA } from '@nestjs/common/constants';

import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EmployeeClearanceModule } from '../../src/modules/employee-clearance/employee-clearance.module';
import { ProjectStagesModule } from '../../src/modules/project-stages/project-stages.module';
import { ProjectTasksModule } from '../../src/modules/project-tasks/project-tasks.module';
import { ProjectTeamMembersModule } from '../../src/modules/project-team-members/project-team-members.module';
import { ProjectsModule } from '../../src/modules/projects/projects.module';
import { TaskParticipantsModule } from '../../src/modules/task-participants/task-participants.module';
import { TaskReviewsModule } from '../../src/modules/task-reviews/task-reviews.module';
import { TaskSubmissionsModule } from '../../src/modules/task-submissions/task-submissions.module';

const FEATURE_MODULES = [
  EmployeeClearanceModule,
  ProjectStagesModule,
  ProjectTasksModule,
  ProjectTeamMembersModule,
  ProjectsModule,
  TaskParticipantsModule,
  TaskReviewsModule,
  TaskSubmissionsModule,
];

function getModuleMetadata(moduleClass: object, metadataKey: string): unknown {
  return Reflect.getMetadata(metadataKey, moduleClass) as unknown;
}

describe('Prisma provider ownership', () => {
  it.each(FEATURE_MODULES)(
    '%p uses the shared Prisma module instead of creating another pool',
    (featureModule) => {
      const importsMetadata = getModuleMetadata(
        featureModule,
        MODULE_METADATA.IMPORTS,
      );
      const providersMetadata = getModuleMetadata(
        featureModule,
        MODULE_METADATA.PROVIDERS,
      );
      const imports = Array.isArray(importsMetadata) ? importsMetadata : [];
      const providers = Array.isArray(providersMetadata)
        ? providersMetadata
        : [];

      expect(imports).toContain(PrismaModule);
      expect(providers).not.toContain(PrismaService);
    },
  );
});
