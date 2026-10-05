import { describe, expect, it } from "vitest";

import { userInviteHref } from "./security-navigation";

describe("userInviteHref", () => {
  it("carries only the employee identifier when starting an employee-linked invite", () => {
    const href = userInviteHref({
      returnTo: "/hr/employees?page=2",
      employeeId: "employee-123",
      displayName: "Synthetic QA Employee",
      email: "synthetic.qa@example.test",
    } as unknown as Parameters<typeof userInviteHref>[0]);

    expect(href).toContain("employeeId=employee-123");
    expect(href).not.toContain("displayName=");
    expect(href).not.toContain("email=");
  });
});
