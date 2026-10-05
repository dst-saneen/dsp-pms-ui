import { describe, expect, it } from "vitest";

import { CAREER_EVENT_TYPE } from "../types/career-timeline";
import {
  containsConfidentialCareerDetail,
  sanitizeCareerTimeline,
} from "./sanitize-career-timeline";

describe("sanitizeCareerTimeline", () => {
  it("removes HR-only detail from employee projections", () => {
    const events = [
      {
        id: "1",
        eventType: CAREER_EVENT_TYPE.INTERVIEWS_COMPLETED,
        occurredAt: "2026-01-01T10:00:00.000Z",
        summary: "Interview process completed.",
        hrDetail: "Panel score: 4.8. Confidential recommendation on file.",
      },
    ];

    const sanitized = sanitizeCareerTimeline(events);

    expect(containsConfidentialCareerDetail(sanitized)).toBe(false);
    expect(sanitized[0]?.hrDetail).toBeUndefined();
    expect(sanitized[0]).not.toHaveProperty("hrDetail");
    expect(sanitized[0]?.summary).toBe("Interview process completed.");
  });
});
