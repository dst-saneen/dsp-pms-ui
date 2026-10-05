import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

import { ModuleCapabilityGate } from "./module-capability-gate";

vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: vi.fn(),
}));

describe("ModuleCapabilityGate", () => {
  const refetch = vi.fn();

  beforeEach(() => {
    vi.mocked(useModuleCapabilities).mockReset();
    refetch.mockReset();
  });

  it("shows a distinct loading state", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      isLoading: true,
      isError: false,
      refetch,
    } as never);

    render(
      <ModuleCapabilityGate capability="projectsNav">
        <div>Projects workspace</div>
      </ModuleCapabilityGate>
    );

    expect(screen.getByText("Checking module availability…")).toBeInTheDocument();
  });

  it("identifies a disabled Projects module with specific guidance", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { projectsNav: false },
      isLoading: false,
      isError: false,
      refetch,
    } as never);

    render(
      <ModuleCapabilityGate capability="projectsNav">
        <div>Projects workspace</div>
      </ModuleCapabilityGate>
    );

    expect(
      screen.getByText(
        "Projects is unavailable for this Company or your role. Ask a Company Administrator to enable the company module or update your access."
      )
    ).toBeInTheDocument();
  });

  it("identifies a capability check failure as degraded and allows retry", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      isLoading: false,
      isError: true,
      refetch,
    } as never);

    render(
      <ModuleCapabilityGate capability="projectsNav">
        <div>Projects workspace</div>
      </ModuleCapabilityGate>
    );

    expect(screen.getByRole("alert")).toHaveTextContent("temporarily degraded");
    fireEvent.click(screen.getByRole("button", { name: "Retry module check" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("renders the workflow when the scoped module is enabled", () => {
    vi.mocked(useModuleCapabilities).mockReturnValue({
      data: { projectsNav: true },
      isLoading: false,
      isError: false,
      refetch,
    } as never);

    render(
      <ModuleCapabilityGate capability="projectsNav">
        <div>Projects workspace</div>
      </ModuleCapabilityGate>
    );

    expect(screen.getByText("Projects workspace")).toBeInTheDocument();
  });
});
