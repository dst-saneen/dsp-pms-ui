import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DesignationForm } from "./designation-form";
import type { Designation } from "../types/designation";

vi.mock("@/components/forms", () => ({
  LookupSelect: () => null,
  MasterFormLayout: ({ children }: { children: ReactNode }) => <>{children}</>,
  RequiredLabel: ({ children }: { children: ReactNode }) => (
    <label>{children}</label>
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  }) => (
    <button
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      onClick={() => onCheckedChange?.(!checked)}
    />
  ),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ hasPermission: () => false }),
}));

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({ data: { onboardingNav: true } }),
}));

vi.mock("@/features/lookups/hooks/use-companies", () => ({
  useCompanies: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/lookups/hooks/use-branches", () => ({
  useBranches: () => ({ data: [], isLoading: false }),
}));

vi.mock("@/features/lookups/hooks/use-departments", () => ({
  useDepartments: () => ({ data: [], isLoading: false }),
}));

const designation: Designation = {
  id: "designation-1",
  companyId: "company-1",
  designationCode: "DES-001",
  designationName: "Senior Analyst",
  level: 4,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  departmentId: "home-department-1",
  onboardingTemplate: {
    id: "template-1",
    versions: [
      {
        id: "version-1",
        departments: [
          {
            id: "link-1",
            departmentId: "onboarding-department-1",
            rowVersion: 1,
            department: {
              id: "onboarding-department-1",
              departmentCode: "ONB-001",
              departmentName: "Onboarding",
              branchId: "branch-1",
            },
          },
        ],
      },
    ],
  },
};

describe("DesignationForm", () => {
  it("retains existing onboarding departments when a non-onboarding manager deactivates a designation", async () => {
    const onSubmit = vi.fn();

    render(<DesignationForm designation={designation} onSubmit={onSubmit} />);

    expect(
      screen.getByText(/Onboarding involvement is hidden because/i),
    ).toBeInTheDocument();

    const activeSwitch = screen.getByRole("switch");
    await waitFor(() => expect(activeSwitch).toBeChecked());
    fireEvent.click(activeSwitch);
    await waitFor(() => expect(activeSwitch).not.toBeChecked());

    fireEvent.submit(document.getElementById("designation-form")!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        isActive: false,
        onboardingInvolvementDepartmentIds: ["onboarding-department-1"],
      }),
    );
  });
});
