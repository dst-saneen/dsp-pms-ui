import { describe, expect, it } from "vitest";

import type { NavigationItem } from "@/types/navigation";

import { classicNavigation, groupedNavigation } from "./navigation";

function collectRoutes(items: NavigationItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.href ? [item.href] : []),
    ...(item.children ? collectRoutes(item.children) : []),
  ]);
}

describe("classic sidebar navigation", () => {
  it("preserves every legacy sidebar destination", () => {
    const routes = classicNavigation.flatMap((group) => collectRoutes(group.items));

    expect([...new Set(routes)].sort()).toEqual([
      "/admin/operations/delivery",
      "/admin/operations/delivery/dead-letters",
      "/admin/operations/delivery/recipient-exceptions",
      "/admin/operations/delivery/suppressions",
      "/administration/branches",
      "/administration/business-calendar",
      "/administration/companies",
      "/administration/company-groups",
      "/administration/departments",
      "/administration/designations",
      "/administration/operations/files",
      "/administration/security",
      "/administration/shifts",
      "/administration/users",
      "/asset-management/asset-categories",
      "/asset-management/asset-types",
      "/asset-management/assets",
      "/asset-management/department-grants",
      "/asset-management/employee-assets",
      "/asset-management/inbox",
      "/asset-management/licenses",
      "/asset-management/transfers",
      "/asset-management/waivers",
      "/dashboard",
      "/hr/attendance",
      "/hr/attendance/exceptions",
      "/hr/attendance/periods",
      "/hr/employee-document-categories",
      "/hr/employee-document-types",
      "/hr/employee-documents",
      "/hr/employee-onboarding",
      "/hr/employee-separations",
      "/hr/employees",
      "/hr/hr-requests",
      "/hr/leave",
      "/hr/leave/balances",
      "/hr/leave/calendar",
      "/hr/leave/comp-off",
      "/hr/leave/holidays",
      "/hr/leave/policies",
      "/hr/leave/types",
      "/hr/onboarding-templates",
      "/hr/overtime",
      "/hr/payroll",
      "/hr/recruitment",
      "/hr/recruitment/applications",
      "/hr/recruitment/candidates",
      "/hr/recruitment/delivery",
      "/hr/recruitment/hiring-decisions",
      "/hr/recruitment/interviews",
      "/hr/recruitment/offers",
      "/hr/recruitment/openings",
      "/hr/work-schedule",
      "/my-workspace",
      "/my-workspace/approvals",
      "/my-workspace/calendar",
      "/my-workspace/hr-requests",
      "/my-workspace/leave/apply",
      "/my-workspace/onboarding",
      "/my-workspace/projects",
      "/my-workspace/timesheets",
      "/office-finance",
      "/office-finance/reports",
      "/office-finance/setup",
      "/office-finance/transactions",
      "/projects/projects",
      "/settings",
      "/settings/security/document-retention",
      "/team/timesheets",
    ]);
  });

  it("keeps the classic My Workspace menu and Apply leave permission", () => {
    const dashboard = classicNavigation.find((group) => group.title === "Dashboard");
    const myWorkspace = dashboard?.items.find((item) => item.title === "My Workspace");

    expect(myWorkspace).toEqual(
      expect.objectContaining({
        href: "/my-workspace",
        permissions: ["hr.self.read"],
      })
    );
    expect(myWorkspace?.children).toContainEqual(
      expect.objectContaining({
        title: "Apply leave",
        href: "/my-workspace/leave/apply",
        permissions: ["hr.self.manage"],
      })
    );
  });
});

describe("grouped sidebar navigation", () => {
  it("keeps the read-safe My leave workspace in V2", () => {
    const myWork = groupedNavigation.find((group) => group.title === "My Work");
    const leaveItems = myWork?.items.filter((item) =>
      item.href?.startsWith("/my-workspace/leave")
    );

    expect(leaveItems).toEqual([
      expect.objectContaining({
        title: "My leave",
        href: "/my-workspace/leave",
        permissions: ["hr.self.read"],
      }),
    ]);
  });
});
