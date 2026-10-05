import { describe, expect, it } from "vitest";

import { JOB_OPENING_STATUS } from "../../types/enums";
import {
  getOpeningApplyPath,
  getOpeningApplyUrl,
  isOpeningAcceptingApplications,
} from "./opening-apply-url";

describe("opening apply url", () => {
  it("builds the public apply path from company and opening codes", () => {
    expect(getOpeningApplyPath("LEARNF-HQ-C4475F", "JO-00001")).toBe(
      "/careers/LEARNF-HQ-C4475F/jobs/JO-00001",
    );
  });

  it("returns a full url when origin is provided", () => {
    expect(
      getOpeningApplyUrl("LEARNF-HQ-C4475F", "JO-00001", "http://localhost:3200"),
    ).toBe("http://localhost:3200/careers/LEARNF-HQ-C4475F/jobs/JO-00001");
  });

  it("is shareable only while the opening is open", () => {
    expect(isOpeningAcceptingApplications(JOB_OPENING_STATUS.OPEN)).toBe(true);
    expect(isOpeningAcceptingApplications(JOB_OPENING_STATUS.DRAFT)).toBe(false);
  });
});
