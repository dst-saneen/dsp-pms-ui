import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SeparationWorkspace } from "./separation-workspace";

vi.mock("../hooks", () => ({
  useCreateEmployeeSeparation: vi.fn(),
  useClearanceDepartmentCandidates: vi.fn(),
  useEmployeeSeparations: vi.fn(),
  useSeparationCommand: vi.fn(),
}));

vi.mock("@/features/employee/hooks/use-employees", () => ({
  useEmployees: vi.fn(),
}));

import {
  useClearanceDepartmentCandidates,
  useCreateEmployeeSeparation,
  useEmployeeSeparations,
  useSeparationCommand,
} from "../hooks";
import { useEmployees } from "@/features/employee/hooks/use-employees";

const queryState = {
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: vi.fn(),
};

describe("SeparationWorkspace", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useCreateEmployeeSeparation).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useSeparationCommand).mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
    vi.mocked(useClearanceDepartmentCandidates).mockReturnValue({ ...queryState, data: [] } as never);
    vi.mocked(useEmployees).mockReturnValue({ ...queryState, data: [] } as never);
  });

  it("uses API-provided collection and row actions", () => {
    vi.mocked(useEmployeeSeparations).mockReturnValue({
      ...queryState,
      data: {
        items: [{
          id: "separation-1", companyId: "company-1", employeeId: "employee-1",
          lastWorkingDate: "2026-09-30", reason: "Resignation", status: "APPROVED",
          version: 1, createdAt: "2026-09-01T00:00:00.000Z",
          employee: { id: "employee-1", firstName: "Asha", lastName: "Kumar" },
          allowedActions: ["COMPLETE"],
        }],
        total: 1, page: 1, limit: 50, allowedActions: ["CREATE"],
      },
    } as never);

    render(<SeparationWorkspace />);

    expect(screen.getByRole("button", { name: "New separation" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });
});
