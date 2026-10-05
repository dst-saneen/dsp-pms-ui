import { describe, expect, it } from "vitest";

import { hasAllowedAction } from "./allowed-actions";
import {
  defaultTrackingMode,
  isPhysicalAssetKind,
  isSoftwareLicenseKind,
  trackingModesForKind,
} from "./kind-tracking";

describe("asset allowed actions", () => {
  it("requires an exact capability before exposing a write action", () => {
    expect(hasAllowedAction(["READ", "TRANSFER"], "TRANSFER")).toBe(true);
    expect(hasAllowedAction(["READ"], "ARCHIVE")).toBe(false);
    expect(hasAllowedAction(undefined, "READ")).toBe(false);
  });
});

describe("asset kind tracking", () => {
  it("pairs software licences to pool tracking only", () => {
    expect(trackingModesForKind("SOFTWARE_LICENSE")).toEqual(["POOL"]);
    expect(defaultTrackingMode("SOFTWARE_LICENSE")).toBe("POOL");
    expect(defaultTrackingMode("HARDWARE")).toBe("INDIVIDUAL");
  });

  it("treats hardware and cards as physical, licences as not", () => {
    expect(isPhysicalAssetKind("HARDWARE")).toBe(true);
    expect(isPhysicalAssetKind("CARD")).toBe(true);
    expect(isPhysicalAssetKind("SOFTWARE_LICENSE")).toBe(false);
    expect(isSoftwareLicenseKind("SOFTWARE_LICENSE")).toBe(true);
  });
});
