import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BranchService } from "@/features/branch/services/branch-service";
import { CompanyService } from "@/features/company/services/company-service";
import { DepartmentService } from "@/features/department/services/department-service";
import { DesignationService } from "@/features/designation/services/designation-service";

import { OwnerEmployeeSelectionDialog } from "./owner-employee-selection-dialog";

vi.mock("@/features/company/services/company-service", () => ({
  CompanyService: { getAll: vi.fn() },
}));
vi.mock("@/features/branch/services/branch-service", () => ({
  BranchService: { getBranches: vi.fn() },
}));
vi.mock("@/features/department/services/department-service", () => ({
  DepartmentService: { getDepartments: vi.fn() },
}));
vi.mock("@/features/designation/services/designation-service", () => ({
  DesignationService: { getDesignations: vi.fn() },
}));

describe("OwnerEmployeeSelectionDialog", () => {
  it("does not auto-select a singleton company or load dependent choices", async () => {
    vi.mocked(CompanyService.getAll).mockResolvedValue([
      {
        id: "company-only",
        companyCode: "ONLY",
        companyName: "Only active company",
        isActive: true,
        createdAt: "2026-09-17T00:00:00.000Z",
        updatedAt: "2026-09-17T00:00:00.000Z",
      },
    ]);
    vi.mocked(BranchService.getBranches).mockResolvedValue([]);
    vi.mocked(DepartmentService.getDepartments).mockResolvedValue([]);
    vi.mocked(DesignationService.getDesignations).mockResolvedValue([]);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <OwnerEmployeeSelectionDialog
          open
          onOpenChange={vi.fn()}
          title="Choose assignment"
          description="Explicit selection required."
          submitLabel="Continue"
          isPending={false}
          onSubmit={vi.fn()}
        />
      </QueryClientProvider>
    );

    await waitFor(() => expect(CompanyService.getAll).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(BranchService.getBranches).not.toHaveBeenCalled();
    expect(DepartmentService.getDepartments).not.toHaveBeenCalled();
    expect(DesignationService.getDesignations).not.toHaveBeenCalled();
  });
});
