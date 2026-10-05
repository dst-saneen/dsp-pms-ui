import type {
  OnboardingDesignerState,
} from "../state";

import type {
  OnboardingWorkspace,
} from "../../workspace";

import {
  TaskSaver,
} from "../savers/task.saver";

import {
  OnboardingWorkspaceService,
} from "../../services/onboarding-workspace-service";

export class OnboardingDesignerSaveService {

  static async save(
    state: OnboardingDesignerState,
  ): Promise<OnboardingWorkspace> {

    await TaskSaver.save(state);

    /**
     * Future
     */

    // await DepartmentSaver.save(state);
    // await TaskGroupSaver.save(state);
    // await ContributionSaver.save(state);
    // await RequirementSaver.save(state);
    // await ExecutionProfileSaver.save(state);
    // await ExecutionRuleSaver.save(state);

    return OnboardingWorkspaceService.getEditor(
      state.workspace.template.id,
    );

  }

}