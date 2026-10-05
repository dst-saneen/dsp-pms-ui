import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateRunDialog } from "./create-run-dialog";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/common/form-sheet", () => ({
  FormSheet: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => (
    <div>
      {children}
      {footer}
    </div>
  ),
}));

vi.mock("../hooks", () => ({
  useCreatePayrollRun: vi.fn(),
  usePayrollPreflight: vi.fn(),
}));

import { useCreatePayrollRun, usePayrollPreflight } from "../hooks";

describe("CreateRunDialog readiness failure", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.mocked(useCreatePayrollRun).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn(),
    } as never);
  });

  it("blocks creation and offers retry when preflight fails", () => {
    vi.mocked(usePayrollPreflight).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("connection lost"),
      refetch: vi.fn(),
    } as never);

    render(<CreateRunDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Create run" })).toBeDisabled();
    expect(screen.getByText("Readiness check unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry readiness check" })).toBeInTheDocument();
  });
});
