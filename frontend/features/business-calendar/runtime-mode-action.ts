export type BusinessCalendarRuntimeMode = "LEGACY" | "SHADOW" | "ACTIVE";

export type BusinessCalendarRuntimeAction = {
  nextMode: Exclude<BusinessCalendarRuntimeMode, "LEGACY">;
  label: string;
  description: string;
};

export function nextBusinessCalendarRuntimeAction(
  mode: BusinessCalendarRuntimeMode,
  hasPublishedVersion: boolean,
): BusinessCalendarRuntimeAction | null {
  if (!hasPublishedVersion) {
    return null;
  }

  if (mode === "LEGACY") {
    return {
      nextMode: "SHADOW",
      label: "Start testing new calendar",
      description:
        "Keep the previous holiday source while checking this published calendar.",
    };
  }

  if (mode === "SHADOW") {
    return {
      nextMode: "ACTIVE",
      label: "Use published calendar",
      description:
        "Use this published calendar for Attendance, Leave, and roster planning.",
    };
  }

  return null;
}
