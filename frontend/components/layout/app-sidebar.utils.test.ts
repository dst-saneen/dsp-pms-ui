import { describe, expect, it } from "vitest";

import type { NavigationItem } from "@/types/navigation";

import { getActiveNavigationHref, navigationRouteMatches } from "./app-sidebar.utils";

describe("app sidebar route matching", () => {
  const workspaceItems: NavigationItem[] = [
    { title: "Overview", href: "/my-workspace" },
    { title: "Projects", href: "/my-workspace/projects" },
    { title: "Timesheets", href: "/my-workspace/timesheets" },
  ];

  it("selects the most specific matching child", () => {
    expect(getActiveNavigationHref("/my-workspace/projects", workspaceItems)).toBe(
      "/my-workspace/projects"
    );
    expect(getActiveNavigationHref("/my-workspace/projects/task-1", workspaceItems)).toBe(
      "/my-workspace/projects"
    );
  });

  it("selects the section index only on the section index route", () => {
    expect(getActiveNavigationHref("/my-workspace", workspaceItems)).toBe("/my-workspace");
  });

  it("selects only the deepest sibling for same-group prefix routes", () => {
    const financeItems: NavigationItem[] = [
      { title: "Dashboard", href: "/office-finance" },
      { title: "Transactions", href: "/office-finance/transactions" },
    ];

    expect(getActiveNavigationHref("/office-finance/transactions", financeItems)).toBe(
      "/office-finance/transactions"
    );
  });

  it("selects a nested cross-group leaf over a matching parent route", () => {
    const navigationItems: NavigationItem[] = [
      { title: "Recruitment dashboard", href: "/hr/recruitment" },
      {
        title: "Operations",
        children: [{ title: "Delivery", href: "/hr/recruitment/delivery" }],
      },
    ];

    expect(getActiveNavigationHref("/hr/recruitment/delivery", navigationItems)).toBe(
      "/hr/recruitment/delivery"
    );
  });

  it("does not treat the dashboard as active for unrelated routes", () => {
    expect(navigationRouteMatches("/dashboard", "/dashboard")).toBe(true);
    expect(navigationRouteMatches("/dashboard/details", "/dashboard")).toBe(false);
  });

  describe("Case 7 menu highlighting routes", () => {
    const recruitmentChildren: NavigationItem[] = [
      { title: "Dashboard", href: "/hr/recruitment" },
      { title: "Delivery", href: "/hr/recruitment/delivery" },
    ];

    const leaveChildren: NavigationItem[] = [
      { title: "Requests", href: "/hr/leave" },
      { title: "Calendar", href: "/hr/leave/calendar" },
      { title: "Holidays", href: "/hr/leave/holidays" },
      { title: "Comp-off", href: "/hr/leave/comp-off" },
    ];

    const financeChildren: NavigationItem[] = [
      { title: "Dashboard", href: "/office-finance" },
      { title: "Transactions", href: "/office-finance/transactions" },
    ];

    const myWorkspaceChildren: NavigationItem[] = [
      { title: "Overview", href: "/my-workspace" },
      { title: "Onboarding", href: "/my-workspace/onboarding" },
    ];

    it("highlights Delivery only on delivery route", () => {
      expect(getActiveNavigationHref("/hr/recruitment/delivery", recruitmentChildren)).toBe(
        "/hr/recruitment/delivery"
      );
    });

    it("highlights Calendar, Holidays and Comp-off on their routes only", () => {
      expect(getActiveNavigationHref("/hr/leave/calendar", leaveChildren)).toBe(
        "/hr/leave/calendar"
      );
      expect(getActiveNavigationHref("/hr/leave/holidays", leaveChildren)).toBe(
        "/hr/leave/holidays"
      );
      expect(getActiveNavigationHref("/hr/leave/comp-off", leaveChildren)).toBe(
        "/hr/leave/comp-off"
      );
    });

    it("does not highlight Leave landing when on a child route", () => {
      expect(getActiveNavigationHref("/hr/leave/calendar", leaveChildren)).not.toBe("/hr/leave");
    });

    it("highlights Transactions on list and detail routes", () => {
      expect(getActiveNavigationHref("/office-finance/transactions", financeChildren)).toBe(
        "/office-finance/transactions"
      );
      expect(
        getActiveNavigationHref(
          "/office-finance/transactions/f5d33da3-18f2-491d-852a-0402a709d3ea",
          financeChildren
        )
      ).toBe("/office-finance/transactions");
    });

    it("highlights Onboarding only on workspace onboarding route", () => {
      expect(getActiveNavigationHref("/my-workspace/onboarding", myWorkspaceChildren)).toBe(
        "/my-workspace/onboarding"
      );
      expect(getActiveNavigationHref("/my-workspace/onboarding", myWorkspaceChildren)).not.toBe(
        "/my-workspace"
      );
    });

    const projectMgmtItems: NavigationItem[] = [
      { title: "Projects", href: "/projects/projects" },
      { title: "Team timesheets", href: "/team/timesheets" },
    ];

    it("highlights Projects on project detail routes only", () => {
      expect(getActiveNavigationHref("/projects/projects", projectMgmtItems)).toBe(
        "/projects/projects"
      );
      expect(
        getActiveNavigationHref("/projects/projects/60854dea-fada-4373-a541-5efb8cef63b0", projectMgmtItems)
      ).toBe("/projects/projects");
      expect(
        getActiveNavigationHref("/projects/projects/60854dea-fada-4373-a541-5efb8cef63b0", projectMgmtItems)
      ).not.toBe("/team/timesheets");
    });

    it("highlights My Projects and Timesheets on workspace nested routes only", () => {
      expect(getActiveNavigationHref("/my-workspace/projects/task-1", workspaceItems)).toBe(
        "/my-workspace/projects"
      );
      expect(getActiveNavigationHref("/my-workspace/timesheets", workspaceItems)).toBe(
        "/my-workspace/timesheets"
      );
      expect(getActiveNavigationHref("/my-workspace/timesheets/week-1", workspaceItems)).toBe(
        "/my-workspace/timesheets"
      );
      expect(getActiveNavigationHref("/my-workspace/timesheets/week-1", workspaceItems)).not.toBe(
        "/my-workspace/projects"
      );
    });

    it("highlights Team Timesheets and Payroll on their detail routes only", () => {
      expect(getActiveNavigationHref("/team/timesheets", projectMgmtItems)).toBe("/team/timesheets");
      expect(getActiveNavigationHref("/team/timesheets/week-2026-09-14", projectMgmtItems)).toBe(
        "/team/timesheets"
      );

      const payrollItems: NavigationItem[] = [{ title: "Payroll", href: "/hr/payroll" }];
      expect(getActiveNavigationHref("/hr/payroll/runs/6cff3c74-8dd4-4793-9d15-e28e97dc5683", payrollItems)).toBe(
        "/hr/payroll"
      );
    });
  });
});
