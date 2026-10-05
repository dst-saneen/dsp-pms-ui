import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/my-workspace/components/my-leave-workspace", () => ({
  MyLeaveWorkspace: ({
    initialYear,
    initialApplyOpen,
    initialFromDate,
  }: {
    initialYear?: number;
    initialApplyOpen?: boolean;
    initialFromDate?: string;
  }) => <div aria-label="My leave route state">
    {JSON.stringify({ initialYear, initialApplyOpen, initialFromDate })}
  </div>,
}));

import MyLeavePage from "./page";

afterEach(cleanup);

describe("My leave route query contract", () => {
  it("passes valid year and application-prefill parameters to the workspace", async () => {
    const page = await MyLeavePage({
      searchParams: Promise.resolve({
        year: "2026",
        action: "apply",
        fromDate: "2026-10-03",
      }),
    });

    render(page);
    expect(screen.getByLabelText("My leave route state")).toHaveTextContent(
      '{"initialYear":2026,"initialApplyOpen":true,"initialFromDate":"2026-10-03"}'
    );
  });

  it("ignores malformed year and date parameters", async () => {
    const page = await MyLeavePage({
      searchParams: Promise.resolve({
        year: "20x6",
        action: "apply",
        fromDate: "javascript:alert(1)",
      }),
    });

    render(page);
    expect(screen.getByLabelText("My leave route state")).toHaveTextContent(
      '{"initialApplyOpen":true}'
    );
  });
});
