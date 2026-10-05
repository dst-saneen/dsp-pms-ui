import { describe, expect, it } from "vitest";

import * as workspace from "./attendance-period-workspace";

describe("attendance period transitions", () => {
  it("offers reopen for a closed period", () => {
    const nextAction = (
      workspace as unknown as {
        nextAttendancePeriodAction: (status: string) => string | null;
      }
    ).nextAttendancePeriodAction;

    expect(typeof nextAction).toBe("function");
    expect(nextAction("CLOSED")).toBe("reopen");
  });

  it("accepts current and transitional review status names", () => {
    const nextAction = (
      workspace as unknown as {
        nextAttendancePeriodAction: (status: string) => string | null;
      }
    ).nextAttendancePeriodAction;

    expect(nextAction("REVIEW")).toBe("lock");
    expect(nextAction("REVIEWED")).toBe("lock");
  });
});
