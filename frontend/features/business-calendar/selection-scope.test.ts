import { describe, expect, it } from "vitest";

import { getScopedSelectionId } from "./selection-scope";

describe("getScopedSelectionId", () => {
  it("keeps an ID only when it belongs to the active scoped options", () => {
    expect(getScopedSelectionId("version-in-company-a", [{ id: "version-in-company-b" }])).toBe("");
    expect(getScopedSelectionId("version-in-company-b", [{ id: "version-in-company-b" }])).toBe(
      "version-in-company-b"
    );
  });

  it("fails closed while scoped options are unavailable", () => {
    expect(getScopedSelectionId("stale-id", [])).toBe("");
  });
});
