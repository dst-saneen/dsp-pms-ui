import { describe, expect, it } from "vitest";

import { getAssetResolutionLinks } from "./asset-resolution-links";

describe("getAssetResolutionLinks", () => {
  it("does not expose Asset routes when the module is unavailable", () => {
    expect(getAssetResolutionLinks(false, () => true)).toEqual([]);
  });

  it("returns only routes permitted for the current HR user", () => {
    const permissions = new Set([
      "assets.department.assignments.read",
      "assets.clearance.waive",
    ]);

    expect(
      getAssetResolutionLinks(true, (permission) => permissions.has(permission))
    ).toEqual([
      { href: "/asset-management/inbox", label: "Custodian Inbox" },
      { href: "/asset-management/waivers", label: "Clearance waivers" },
    ]);
  });

  it("does not expose links to an HR-only user", () => {
    expect(getAssetResolutionLinks(true, () => false)).toEqual([]);
  });
});
