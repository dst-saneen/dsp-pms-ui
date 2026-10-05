import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ user: { employeeId: "employee-1" } }),
}));

vi.mock("@/features/my-workspace/components/apply-leave-sheet", () => ({
  ApplyLeaveSheet: () => null,
}));

import LegacyApplyLeavePage from "./page";

describe("legacy Apply leave route", () => {
  it("redirects bookmarks to the canonical My leave application flow", () => {
    render(<LegacyApplyLeavePage />);

    expect(redirectMock).toHaveBeenCalledWith("/my-workspace/leave?action=apply");
  });
});
