import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectWorkspace } from "./project-workspace";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({ isPending: false, mutate: vi.fn() }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));

vi.mock("../hooks/use-projects", () => ({
  useProjectsList: () => ({
    data: { items: [] },
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

let canCreateProject = true;

vi.mock("../hooks/use-workspace-capabilities", () => ({
  useWorkspaceCapabilities: () => ({
    data: { canCreateProject, clientProjectsEnabled: true },
  }),
}));

vi.mock("@/features/office-finance/hooks", () => ({
  useBusinessParties: () => ({ data: { items: [] } }),
}));

vi.mock("../services/projects-api.service", () => ({
  ProjectsApiService: {
    create: vi.fn(),
    getManagerCandidates: vi.fn().mockResolvedValue([]),
  },
}));

describe("ProjectWorkspace accessibility", () => {
  afterEach(() => {
    canCreateProject = true;
    cleanup();
  });

  it("gives the list controls clear accessible names", () => {
    render(<ProjectWorkspace />);

    expect(screen.getByRole("textbox", { name: "Search projects" })).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: "Filter projects by status" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh projects" })).toBeInTheDocument();
  });

  it("associates visible labels with the project create controls", async () => {
    const user = userEvent.setup();
    render(<ProjectWorkspace />);

    await user.click(screen.getByRole("button", { name: "New project" }));

    expect(await screen.findByRole("combobox", { name: "Project manager" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project type" })).toBeInTheDocument();
  });

  it("uses the canonical module name when project creation is unavailable", () => {
    canCreateProject = false;
    render(<ProjectWorkspace />);

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent?.includes("Projects enabled for this company") === true,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Projects Lite/i)).not.toBeInTheDocument();
  });
});
