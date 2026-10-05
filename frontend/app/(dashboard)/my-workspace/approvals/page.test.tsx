import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MyApprovalsPage from "./page";

vi.mock("@/features/hr-operations", () => ({
  MyWorkQueuesWorkspace: () => <div>Queue workspace</div>,
}));

describe("MyApprovalsPage", () => {
  it("uses the concise approvals and clearance introduction", () => {
    render(<MyApprovalsPage />);

    expect(screen.getByRole("heading", { name: "Approvals & clearance" })).toBeVisible();
    expect(
      screen.getByText("Review requests assigned to you and complete clearance actions.")
    ).toBeVisible();
    expect(screen.queryByText(/real reason/)).not.toBeInTheDocument();
  });
});
