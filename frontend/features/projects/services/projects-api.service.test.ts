import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/services/api-client";

import { ProjectsApiService } from "./projects-api.service";

vi.mock("@/services/api-client", () => ({
  apiClient: {
    get: vi.fn(),
  },
  unwrapApiData: (payload: { data: unknown }) => payload.data,
}));

describe("ProjectsApiService.getMyTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the authorized employee task detail from the self-service route", async () => {
    const taskDetail = {
      id: "task-1",
      version: 3,
      projectId: "project-1",
      stageId: "stage-1",
      taskCode: "TSK-2026-012",
      taskName: "Configure payroll calculations",
      description: null,
      parentTaskId: null,
      priority: "HIGH",
      plannedHours: "16",
      completionPercentage: "65",
      status: "IN_PROGRESS",
      startDate: "2026-09-20",
      dueDate: "2026-09-28",
      projectCode: null,
      projectName: null,
      activeParticipantEmployeeIds: ["employee-1"],
      allowedActions: ["SUBMIT_REVIEW"],
      actionRequirements: { expectedVersion: 3 },
      submissions: [],
      assignmentHistory: [],
      documents: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { success: true, data: taskDetail },
    });

    const result = await ProjectsApiService.getMyTask("task-1");

    expect(result).toEqual(taskDetail);
    expect(apiClient.get).toHaveBeenCalledWith("/me/project-tasks/task-1");
  });
});
