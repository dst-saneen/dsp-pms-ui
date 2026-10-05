import { Injectable } from '@nestjs/common';

import {
  TemplateAssembler,
  DepartmentAssembler,
  TaskGroupAssembler,
  TaskAssembler,
  ContributionAssembler,
} from '../assemblers';

import { WorkspaceMapper } from '../mappers/workspace.mapper';

@Injectable()
export class OnboardingWorkspaceService {
  constructor(
    private readonly templateAssembler: TemplateAssembler,

    private readonly departmentAssembler: DepartmentAssembler,

    private readonly taskGroupAssembler: TaskGroupAssembler,

    private readonly taskAssembler: TaskAssembler,

    private readonly contributionAssembler: ContributionAssembler,

    private readonly mapper: WorkspaceMapper,
  ) {}

  async loadTemplateVersion(versionId: string) {
    const template = await this.templateAssembler.load(versionId);

    const departments = await this.departmentAssembler.load(versionId);

    const taskGroups = await this.taskGroupAssembler.load(
      departments.map((d) => d.id),
    );

    const tasks = await this.taskAssembler.load(taskGroups.map((g) => g.id));

    const taskContributions = await this.contributionAssembler.load(
      tasks.map((t) => t.id),
    );

    return this.mapper.map({
      template,

      departments,

      taskGroups,

      tasks,

      taskContributions,
    });
  }
}
