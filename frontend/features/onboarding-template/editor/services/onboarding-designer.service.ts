import type {
  OnboardingDesignerState,
} from "../state";

import {
  TaskSaver,
} from "../savers/task.saver";

export class OnboardingDesignerService {

  static async save(
    state: OnboardingDesignerState,
  ): Promise<void> {

    await TaskSaver.save(
      state,
    );

    /**
     * Future
     */

    // await DepartmentSaver.save(state);

    // await TaskGroupSaver.save(state);

    // await ContributionSaver.save(state);

    // await RequirementSaver.save(state);

    // await ExecutionProfileSaver.save(state);

    // await ExecutionRuleSaver.save(state);

  }

}