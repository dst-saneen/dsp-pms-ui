import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingApiService } from "../services/onboarding-api.service";
import { MyOwnOnboardingSummary } from "./MyOwnOnboardingSummary";

vi.mock("../services/onboarding-api.service", () => ({
  OnboardingApiService: {
    getMeOnboarding: vi.fn(),
  },
}));

const onboarding = {
  id: "onboarding-1",
  contractVersion: "V2" as const,
  version: 3,
  status: "IN_PROGRESS" as const,
  employee: {
    id: "employee-1",
    employeeCode: "EMP-1042",
    displayName: "Rohan Kumar",
  },
  organizationSnapshot: {
    company: { id: "company-1", code: "GROUP", name: "Group ERP" },
    branch: { id: "branch-1", code: "HQ", name: "Main Office", timeZone: "Asia/Kolkata" },
    department: { id: "department-1", code: "ENG", name: "Engineering" },
    designation: { id: "designation-1", code: "TL", name: "Team Lead" },
  },
  templateSnapshot: {
    templateId: "template-1",
    templateCode: "EMP-ONBOARDING",
    templateName: "Employee onboarding program",
    templateVersionId: "version-1",
    versionNo: 1,
    resolutionSource: "DESIGNATION_DEFAULT",
  },
  startDate: "2026-09-12",
  startedBy: { userId: "user-1", displayName: "HR Admin" },
  completedAt: null,
  cancelledAt: null,
  progress: {
    total: 12,
    completed: 8,
    skipped: 0,
    waived: 0,
    terminal: 8,
    mandatoryRemaining: 3,
    unfinishedOptional: 1,
    unassignedMandatory: 0,
    overdue: 1,
    canComplete: false,
    percent: 68,
  },
  departmentProgress: [
    {
      workstreamDepartment: { id: "hr", name: "HR" },
      total: 4,
      terminal: 3,
      mandatoryRemaining: 1,
      unassigned: 0,
      dueSoon: 0,
      overdue: 0,
      percent: 75,
    },
  ],
  blockedReasons: [],
  allowedActions: [],
  actionCapabilities: [],
};

function renderSummary(onOpenTasks = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MyOwnOnboardingSummary onOpenTasks={onOpenTasks} />
    </QueryClientProvider>,
  );

  return onOpenTasks;
}

beforeEach(() => {
  vi.mocked(OnboardingApiService.getMeOnboarding).mockResolvedValue({
    ownOnboarding: onboarding,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MyOwnOnboardingSummary", () => {
  it("renders the onboarding progress as one action-first command panel", async () => {
    const onOpenTasks = renderSummary();

    expect(await screen.findByText("Employee onboarding program")).toBeVisible();
    expect(screen.getByText("68%")).toBeVisible();
    expect(screen.getByText("8 completed")).toBeVisible();
    expect(screen.getByText("3 mandatory remaining")).toBeVisible();
    expect(screen.getByText("1 overdue")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Continue next task" }));
    expect(onOpenTasks).toHaveBeenCalledOnce();
  });
});
