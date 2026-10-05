import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssetToolbar } from "./asset-toolbar";

describe("AssetToolbar accessibility", () => {
  afterEach(cleanup);

  it("names the search and department filter controls", () => {
    render(
      <AssetToolbar
        search=""
        onSearchChange={vi.fn()}
        departmentId=""
        onDepartmentChange={vi.fn()}
        departments={[]}
        onAdd={vi.fn()}
        onRefresh={vi.fn()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search assets" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter assets by department" }),
    ).toBeInTheDocument();
  });
});
