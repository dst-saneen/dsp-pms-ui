import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PermissionPicker } from "./permission-picker";

describe("PermissionPicker accessibility", () => {
  afterEach(cleanup);

  it("names each namespace action with the permissions it changes", () => {
    render(
      <PermissionPicker
        permissions={[
          {
            id: "assets-read",
            code: "assets.assets.read",
            name: "Read assets",
          },
          {
            id: "calendar-read",
            code: "calendar.business.read",
            name: "Read calendars",
          },
        ] as never}
        selectedIds={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Select assets permissions" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select calendar permissions" }),
    ).toBeInTheDocument();
  });
});
