import { describe, expect, it } from "vitest";

import { OnboardingTemplateTaskMapper } from "./onboarding-template-task.mapper";
import type { OnboardingTemplateTask } from "../types";

describe("OnboardingTemplateTaskMapper", () => {
  const task: OnboardingTemplateTask = {
    id: "task-1",
    onboardingTemplateId: "tpl-1",
    taskGroupId: "group-1",
    taskName: "Setup laptop",
    sequenceNo: 1,
    priority: 1,
    isMandatory: true,
    allowSkip: false,
    allowResubmit: true,
    allowReopen: true,
    autoComplete: false,
    workType: "CHECKLIST",
    ownerType: "DEPARTMENT",
    assignedDepartmentId: "should-not-send",
    assignedEmployeeId: "should-not-send",
    assignedDesignationId: "should-not-send",
    approvalWorkflowId: "should-not-send",
    rowVersion: 3,
    createdAt: "2026-08-19T00:00:00.000Z",
    updatedAt: "2026-08-19T00:00:00.000Z",
  };

  it("omits named assignment and approval fields from writes", () => {
    const created = OnboardingTemplateTaskMapper.toCreateDto(task);
    const updated = OnboardingTemplateTaskMapper.toUpdateDto(task);

    expect(created).not.toHaveProperty("assignedEmployeeId");
    expect(created).not.toHaveProperty("assignedDesignationId");
    expect(created).not.toHaveProperty("assignedDepartmentId");
    expect(created).not.toHaveProperty("approvalWorkflowId");
    expect(created.ownerType).toBe("DEPARTMENT");
    expect(created.workType).toBe("CHECKLIST");
    expect(updated.expectedVersion).toBe(3);
  });
});
