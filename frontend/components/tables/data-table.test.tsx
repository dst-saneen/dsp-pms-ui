import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DataTable } from "./data-table";

describe("DataTable keyboard row activation", () => {
  afterEach(cleanup);

  it.each([
    ["Enter", "{Enter}"],
    ["Space", " "],
  ])("keeps %s on a nested button separate from row activation", async (_key, input) => {
    const user = userEvent.setup();
    const openRow = vi.fn();
    const openCalendar = vi.fn();

    render(
      <DataTable
        columns={[
          { accessorKey: "name", header: "Name" },
          {
            id: "calendar",
            header: "Calendar",
            cell: () => (
              <button type="button" onClick={openCalendar}>
                Working days
              </button>
            ),
          },
        ]}
        data={[{ name: "North" }]}
        onRowClick={openRow}
        getRowLabel={(row) => `Open ${row.name}`}
      />,
    );

    screen.getByRole("button", { name: "Working days" }).focus();
    await user.keyboard(input);

    expect(openCalendar).toHaveBeenCalledOnce();
    expect(openRow).not.toHaveBeenCalled();

    screen.getByRole("row", { name: "Open North" }).focus();
    await user.keyboard(input);

    expect(openRow).toHaveBeenCalledOnce();
    expect(openCalendar).toHaveBeenCalledOnce();
  });
});
