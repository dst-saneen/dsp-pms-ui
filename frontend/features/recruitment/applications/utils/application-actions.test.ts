import { describe, expect, it } from "vitest";

import { JOB_APPLICATION_STATUS } from "../../types/enums";
import type { JobApplication } from "../types/job-application";
import {
  buildApplicationAllowedActions,
  resolveApplicationPrimaryAction,
} from "./application-actions";

function stubApplication(
  status: JobApplication["status"],
  allowedOverrides?: Partial<JobApplication["allowedActions"]>,
): Pick<JobApplication, "status" | "allowedActions" | "nextAction"> {
  return {
    status,
    allowedActions: {
      ...buildApplicationAllowedActions(status),
      ...allowedOverrides,
    },
  };
}

describe("resolveApplicationPrimaryAction", () => {
  it("returns a single shortlist action for applied applications", () => {
    expect(
      resolveApplicationPrimaryAction(stubApplication(JOB_APPLICATION_STATUS.APPLIED)),
    ).toMatchObject({
      kind: "shortlist",
      label: "Shortlist",
    });
  });

  it("blocks shortlist when the backend capability is unavailable", () => {
    expect(
      resolveApplicationPrimaryAction(
        stubApplication(JOB_APPLICATION_STATUS.APPLIED),
        { shortlistAvailable: false },
      ),
    ).toMatchObject({
      kind: "blocked",
    });
  });

  it("routes interview stage to the interviews tab when manager advance is not ready", () => {
    expect(
      resolveApplicationPrimaryAction(
        stubApplication(JOB_APPLICATION_STATUS.INTERVIEW),
      ),
    ).toMatchObject({
      kind: "open_interviews",
      tab: "interviews",
    });
  });

  it("routes manager review to the hiring decision workspace", () => {
    expect(
      resolveApplicationPrimaryAction(
        stubApplication(JOB_APPLICATION_STATUS.MANAGER_REVIEW),
      ),
    ).toMatchObject({
      kind: "open_hiring_decision",
      label: "Open hiring decision",
    });
  });

  it("explains terminal states without offering transitions", () => {
    expect(
      resolveApplicationPrimaryAction(
        stubApplication(JOB_APPLICATION_STATUS.REJECTED),
      ),
    ).toMatchObject({
      kind: "terminal",
    });
  });
});
