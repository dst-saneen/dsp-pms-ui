import type {
  OnboardingTemplateTask,
  CreateOnboardingTemplateTask,
  UpdateOnboardingTemplateTask,
} from "../types";

export class OnboardingTemplateTaskMapper {
  static toCreateDto(
    task: Pick<
      OnboardingTemplateTask,
      | "taskGroupId"
      | "taskName"
      | "description"
      | "sequenceNo"
      | "priority"
      | "isMandatory"
      | "allowSkip"
      | "allowReopen"
      | "workType"
      | "ownerType"
      | "referenceType"
      | "referenceId"
      | "dependsOnTaskId"
      | "dueDays"
    >,
  ): CreateOnboardingTemplateTask {
    const workType =
      task.workType === "ASSET" ? "ASSET" : "CHECKLIST";
    const ownerType =
      task.ownerType === "EMPLOYEE" || task.ownerType === "MANAGER"
        ? task.ownerType
        : "DEPARTMENT";

    return {
      taskGroupId: task.taskGroupId ?? "",
      taskName: task.taskName,
      description: task.description ?? undefined,
      sequenceNo: task.sequenceNo,
      priority: task.priority,
      isMandatory: task.isMandatory,
      allowSkip: task.allowSkip,
      allowReopen: task.allowReopen,
      workType,
      ownerType,
      referenceType:
        workType === "ASSET" ? "ASSET_TYPE" : undefined,
      referenceId: task.referenceId ?? undefined,
      dependsOnTaskId: task.dependsOnTaskId ?? undefined,
      dueDays: task.dueDays ?? undefined,
    };
  }

  static toUpdateDto(
    task: OnboardingTemplateTask,
  ): UpdateOnboardingTemplateTask {
    const created = this.toCreateDto(task);

    return {
      taskName: created.taskName,
      description: created.description,
      sequenceNo: created.sequenceNo,
      priority: created.priority,
      isMandatory: created.isMandatory,
      allowSkip: created.allowSkip,
      allowReopen: created.allowReopen,
      workType: created.workType,
      ownerType: created.ownerType,
      referenceType: created.referenceType,
      referenceId: created.referenceId,
      dependsOnTaskId: created.dependsOnTaskId,
      dueDays: created.dueDays,
      expectedVersion: task.rowVersion ?? 1,
    };
  }
}
