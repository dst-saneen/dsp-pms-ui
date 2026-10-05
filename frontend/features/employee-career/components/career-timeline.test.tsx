import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CAREER_EVENT_TYPE } from "../types/career-timeline";
import { CareerTimeline } from "./career-timeline";

describe("CareerTimeline", () => {
  it("shows employee-visible summaries without HR-only detail by default", () => {
    render(
      <CareerTimeline
        events={[
          {
            id: "1",
            eventType: CAREER_EVENT_TYPE.OFFER_ACCEPTED,
            occurredAt: "2026-01-01T10:00:00.000Z",
            summary: "Offer accepted.",
            hrDetail: "Compensation reference withheld from employee view.",
          },
        ]}
      />,
    );

    expect(screen.getByText("Offer accepted.")).toBeInTheDocument();
    expect(
      screen.queryByText("Compensation reference withheld from employee view."),
    ).not.toBeInTheDocument();
  });

  it("shows HR-only detail when enabled", () => {
    render(
      <CareerTimeline
        showHrDetail
        events={[
          {
            id: "1",
            eventType: CAREER_EVENT_TYPE.INTERVIEWS_COMPLETED,
            occurredAt: "2026-01-01T10:00:00.000Z",
            summary: "Interview process completed.",
            hrDetail: "Panel evaluations retained under confidential records.",
          },
        ]}
      />,
    );

    expect(
      screen.getByText("Panel evaluations retained under confidential records."),
    ).toBeInTheDocument();
  });
});
