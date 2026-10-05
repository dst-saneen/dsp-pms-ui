import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RoleAssignmentEditor } from "./role-assignment-editor";

vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: [] }),
}));

describe("RoleAssignmentEditor accessibility", () => {
  afterEach(cleanup);

  it("associates every role-assignment selector with its visible label", () => {
    render(
      <RoleAssignmentEditor
        assignments={[]}
        onChange={vi.fn()}
        roles={[{ id: "role-1", name: "QA role" }] as never}
        companyGroups={[]}
        companies={[{ id: "company-1", name: "QA company" }]}
        isGlobal={false}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Role" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Access scope" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Company" })).toBeInTheDocument();
  });
});
