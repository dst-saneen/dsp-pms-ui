import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceMapper {
  map(data: {
    template: unknown;
    departments: unknown[];
    taskGroups: unknown[];
    tasks: unknown[];
    taskContributions: unknown[];
  }) {
    return {
      template: data.template,
      departments: data.departments,
      taskGroups: data.taskGroups,
      tasks: data.tasks,
      taskContributions: data.taskContributions,
    };
  }
}
