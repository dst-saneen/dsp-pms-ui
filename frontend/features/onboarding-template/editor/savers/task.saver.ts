import type { OnboardingDesignerState } from "../state";

import {
  OnboardingTemplateTaskMapper,
  OnboardingTemplateTaskService,
} from "@/features/onboarding-template-task";

export class TaskSaver {
  static async save(state: OnboardingDesignerState) {
    const changedIds = Object.keys(state.changedTasks);

    if (changedIds.length === 0) {
      return;
    }

    const tasks =
      state.workspace.template.version?.departments
        .flatMap((department) => department.taskGroups ?? [])
        .flatMap((group) => group.tasks ?? [])
        .filter((task) => changedIds.includes(task.id)) ?? [];

    await Promise.all(
      tasks.map((task) =>
        OnboardingTemplateTaskService.update(
          task.id,
          OnboardingTemplateTaskMapper.toUpdateDto(task),
        ),
      ),
    );
  }
}
