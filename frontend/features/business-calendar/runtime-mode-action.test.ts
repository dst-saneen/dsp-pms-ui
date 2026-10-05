import { describe, expect, it } from "vitest";

import { nextBusinessCalendarRuntimeAction } from "./runtime-mode-action";

describe("business calendar runtime activation actions", () => {
  it("does not offer a runtime transition until a version is published", () => {
    expect(nextBusinessCalendarRuntimeAction("LEGACY", false)).toBeNull();
  });

  it("moves a published legacy calendar into the testing mode before activation", () => {
    expect(nextBusinessCalendarRuntimeAction("LEGACY", true)).toEqual({
      nextMode: "SHADOW",
      label: "Start testing new calendar",
      description:
        "Keep the previous holiday source while checking this published calendar.",
    });
  });

  it("lets a tested calendar become the active company holiday source", () => {
    expect(nextBusinessCalendarRuntimeAction("SHADOW", true)).toEqual({
      nextMode: "ACTIVE",
      label: "Use published calendar",
      description:
        "Use this published calendar for Attendance, Leave, and roster planning.",
    });
  });

  it("does not offer another transition when the calendar is already active", () => {
    expect(nextBusinessCalendarRuntimeAction("ACTIVE", true)).toBeNull();
  });
});
