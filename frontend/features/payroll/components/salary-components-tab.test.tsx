import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SalaryComponentsTab } from "./salary-components-tab";

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({
    data: { payrollActions: ["MANAGE_COMPONENTS"] },
  }),
}));

vi.mock("../hooks", () => ({
  useSalaryComponents: () => ({
    data: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useCreateSalaryComponent: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@/components/tables/data-table", () => ({
  DataTable: () => <div>table</div>,
}));

describe("SalaryComponentsTab", () => {
  it("shows Add component when MANAGE_COMPONENTS is present", () => {
    render(<SalaryComponentsTab />);
    expect(screen.getByText("Add component")).toBeInTheDocument();
  });
});
