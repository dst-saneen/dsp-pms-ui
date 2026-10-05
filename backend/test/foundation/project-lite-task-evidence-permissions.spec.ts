import 'reflect-metadata';

import {
  REQUIRED_ANY_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_KEY,
} from '../../src/common/decorators/require-permissions.decorator';
import { PROJECTS_PERMISSIONS } from '../../src/modules/projects/constants/projects-permissions';
import { ProjectNestedTasksController } from '../../src/modules/projects/project-nested-tasks.controller';

describe('Project task evidence download authorization', () => {
  it('allows either project readers or assigned task workers at the controller boundary', () => {
    const target = ProjectNestedTasksController.prototype.downloadGrant;

    expect(Reflect.getMetadata(REQUIRED_ANY_PERMISSIONS_KEY, target)).toEqual([
      PROJECTS_PERMISSIONS.READ,
      PROJECTS_PERMISSIONS.TASKS_WORK,
    ]);
    expect(Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, target)).toBeUndefined();
  });
});
