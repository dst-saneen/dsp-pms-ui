import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BranchService } from "@/features/branch/services/branch-service";

import { RequiredSetupSection } from "./required-setup-section";
import { organizationOnboardingService } from "../organization-onboarding-service";
import type { OrganizationOnboardingStatus } from "../types";

vi.mock("@/features/branch/services/branch-service", () => ({
  BranchService: {
    getBranches: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock("@/features/department/services/department-service", () => ({
  DepartmentService: { create: vi.fn() },
}));
vi.mock("../organization-onboarding-service", () => ({
  organizationOnboardingService: {
    status: vi.fn(),
    updateStep: vi.fn(),
  },
}));

const status: OrganizationOnboardingStatus = {
  id: "onboarding",
  companyGroupId: "group",
  ownerUserId: "owner",
  status: "IN_PROGRESS",
  currentStep: "STRUCTURE",
  isOwner: true,
  companyGroup: {
    id: "group",
    groupCode: "QA",
    groupName: "QA Group",
  },
  company: {
    id: "company",
    companyCode: "QA-COMPANY",
    companyName: "QA Company",
  },
  counts: {
    branches: 2,
    departments: 0,
    designations: 1,
    shifts: 0,
  },
  requirements: {
    company: true,
    branch: true,
    department: false,
    designation: true,
  },
};

describe("RequiredSetupSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires a branch choice instead of using the first returned branch", async () => {
    vi.mocked(BranchService.getBranches).mockResolvedValue([
      {
        id: "branch-first",
        companyId: "company",
        branchCode: "FIRST",
        branchName: "First branch",
        isActive: true,
      },
      {
        id: "branch-second",
        companyId: "company",
        branchCode: "SECOND",
        branchName: "Second branch",
        isActive: true,
      },
    ]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <RequiredSetupSection status={status} />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(BranchService.getBranches).toHaveBeenCalledWith("company"),
    );
    await user.click(screen.getByRole("button", { name: "Add department" }));

    expect(screen.getByRole("button", { name: "Save department" })).toBeDisabled();
    expect(screen.getByText("Select branch")).toBeInTheDocument();
  });

  it("uses the read-only Company country and requires explicit subdivision and timezone", async () => {
    const branchStatus: OrganizationOnboardingStatus = {
      ...status,
      currentStep: "BRANCH",
      company: {
        ...status.company!,
        legalCountryCode: "IN",
      },
      counts: {
        ...status.counts,
        branches: 0,
      },
      requirements: {
        ...status.requirements,
        branch: false,
      },
    };
    vi.mocked(BranchService.getBranches).mockResolvedValue([]);
    vi.mocked(BranchService.create).mockResolvedValue({
      id: "branch-created",
      companyId: "company",
      branchCode: "BR-001",
      branchName: "Main Branch",
      countryCode: "IN",
      countrySubdivisionCode: "IN-KL",
      timezone: "Asia/Kolkata",
      isActive: true,
    });
    vi.mocked(organizationOnboardingService.status).mockResolvedValue(
      branchStatus,
    );
    vi.mocked(organizationOnboardingService.updateStep).mockResolvedValue(
      branchStatus,
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <RequiredSetupSection status={branchStatus} />
      </QueryClientProvider>,
    );

    const confirmBranch = screen.getByRole("button", { name: "Confirm branch" });
    expect(confirmBranch).toBeEnabled();
    fireEvent.click(confirmBranch);

    const country = screen.getByLabelText("Company legal country");
    expect(country).toHaveValue("IN");
    expect(country).toHaveAttribute("readonly");
    expect(screen.queryByDisplayValue("AE")).not.toBeInTheDocument();

    const saveButton = screen.getByRole("button", { name: "Save branch" });
    expect(saveButton).toBeDisabled();
    await user.type(screen.getByLabelText(/Subdivision code/), "IN-KL");
    await user.type(screen.getByLabelText(/Timezone/), "Asia/Kolkata");
    expect(saveButton).toBeEnabled();
    await user.click(saveButton);

    await waitFor(() =>
      expect(BranchService.create).toHaveBeenCalledWith({
        companyId: "company",
        branchName: "Main Branch",
        addressLine1: undefined,
        city: undefined,
        countryCode: "IN",
        countrySubdivisionCode: "IN-KL",
        timezone: "Asia/Kolkata",
      }),
    );
  });
});
