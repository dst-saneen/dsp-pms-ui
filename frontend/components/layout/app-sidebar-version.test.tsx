import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { SidebarProvider } from "./sidebar-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const { usePathname } = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/dashboard"),
}));

vi.mock("next/navigation", () => ({ usePathname }));
vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({ hasPermission: () => true }),
}));
vi.mock("@/hooks/use-module-capabilities", () => ({
  useModuleCapabilities: () => ({
    data: {
      financeNav: true,
      payrollNav: true,
      projectsNav: true,
      onboardingNav: true,
      assetsNav: true,
      deliveryOperationsNav: true,
      fileOperationsNav: true,
      recruitmentNav: true,
    },
    isLoading: false,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("sidebar version switch", () => {
  afterEach(cleanup);

  beforeEach(() => {
    window.localStorage.clear();
  });

  it("defaults to classic navigation and switches to the grouped sidebar", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <AppHeader />
          <AppSidebar brand={<span>Group ERP</span>} />
        </SidebarProvider>
      </TooltipProvider>
    );

    expect(screen.getByText("My Workspace")).toBeInTheDocument();
    expect(screen.queryByText("My Work")).not.toBeInTheDocument();

    const versionControl = screen.getByRole("group", { name: "Sidebar version" });
    expect(versionControl).toBeVisible();
    expect(screen.getByRole("button", { name: "Use V1 classic sidebar" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Use V2 grouped sidebar" }));

    expect(screen.getByText("My Work")).toBeInTheDocument();
    expect(screen.queryByText("My Workspace")).not.toBeInTheDocument();
    expect(window.localStorage.getItem("group-erp.sidebar-version")).toBe("v2");
  });

  it("restores a previously selected version", async () => {
    window.localStorage.setItem("group-erp.sidebar-version", "v2");

    render(
      <TooltipProvider>
        <SidebarProvider>
          <AppHeader />
          <AppSidebar brand={<span>Group ERP</span>} />
        </SidebarProvider>
      </TooltipProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Use V2 grouped sidebar" })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
    expect(screen.getByText("My Work")).toBeInTheDocument();
  });
});
