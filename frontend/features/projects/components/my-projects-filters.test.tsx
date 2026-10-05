import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MyProjectsFilters as MyProjectsFiltersValue } from "../lib/my-projects-view-model";
import { MyProjectsFilters } from "./my-projects-filters";

const value: MyProjectsFiltersValue = {
  keyword: "payroll",
  projectId: "ALL",
  status: "ALL",
  priority: "ALL",
  due: "ALL",
  sort: "TASK_ASC",
};

describe("MyProjectsFilters", () => {
  it("renders removable chips for active search and non-default sort", () => {
    const onChange = vi.fn();
    render(
      <MyProjectsFilters
        value={value}
        projectOptions={[]}
        priorityOptions={[]}
        activeFilterCount={2}
        onChange={onChange}
        onClear={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Search: payroll/ }));
    expect(onChange).toHaveBeenLastCalledWith({ ...value, keyword: "" });

    fireEvent.click(screen.getByRole("button", { name: /Sort: Task asc/i }));
    expect(onChange).toHaveBeenLastCalledWith({ ...value, sort: "DUE_ASC" });
  });
});
